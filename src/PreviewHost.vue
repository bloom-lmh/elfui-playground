<template>
  <main :class="['preview-host', theme]">
    <div id="app" ref="mount" class="preview-mount"></div>
    <p v-if="message" class="preview-message">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import * as core from "@elfui/core";
import * as reactivity from "@elfui/reactivity";
import * as runtime from "@elfui/runtime/internal";
import { onBeforeUnmount, onMounted, ref } from "vue";

import type {
  PlaygroundImportMap,
  PlaygroundTheme,
  PreviewConsoleMessage,
  PreviewLogLevel,
  PreviewRunMessage,
  PreviewStatusMessage,
  PreviewThemeMessage
} from "./protocol";

const mount = ref<HTMLElement | null>(null);
const message = ref("");
const theme = ref<PlaygroundTheme>(new URLSearchParams(window.location.search).get("theme") === "light" ? "light" : "dark");
let activeModuleUrls: string[] = [];
let currentRunId = 0;

const parentOrigin = (): string => {
  try {
    return new URL(document.referrer).origin;
  } catch {
    return "*";
  }
};

const postStatus = (status: PreviewStatusMessage) => {
  window.parent.postMessage(status, parentOrigin());
};

const formatConsoleValue = (value: unknown): string => {
  if (value instanceof Error) return value.stack ? `${value.name}: ${value.message}\n${value.stack}` : `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value !== "object") return String(value);

  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === "bigint") return `${item}n`;
      if (typeof item === "function") return `[Function ${item.name || "anonymous"}]`;
      if (typeof item === "symbol") return item.toString();
      if (item instanceof Error) return { message: item.message, name: item.name, stack: item.stack };
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    }, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

const postConsole = (level: PreviewLogLevel, values: unknown[], id = currentRunId) => {
  const status: PreviewConsoleMessage = {
    id,
    level,
    message: values.map(formatConsoleValue).join(" "),
    type: "elfui-playground:console"
  };
  window.parent.postMessage(status, parentOrigin());
};

const originalConsole = {
  debug: console.debug.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console)
};

const installConsoleForwarder = () => {
  for (const level of Object.keys(originalConsole) as PreviewLogLevel[]) {
    console[level] = (...values: unknown[]) => {
      originalConsole[level](...values);
      postConsole(level, values);
    };
  }
};

const restoreConsole = () => {
  for (const level of Object.keys(originalConsole) as PreviewLogLevel[]) console[level] = originalConsole[level];
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => postConsole("error", [event.reason]);

const bindingsFor = (specifiers: string, namespace: string): string => {
  const bindings = specifiers
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+as\s+/, ": "));

  // The preview injects framework bindings because user modules run from Blob URLs.
  return `var { ${bindings.join(", ")} } = ${namespace};`;
};

const normalizePath = (value: string): string => value.replace(/\\/g, "/").replace(/^\.\//, "");

const resolveProjectImport = (from: string, specifier: string, files: PreviewRunMessage["files"]) => {
  const fromParts = normalizePath(from).split("/");
  fromParts.pop();
  const parts = [...fromParts, ...specifier.split("/")];
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  const path = normalized.join("/");
  const candidates = [path, `${path}.ts`, `${path}/index.ts`];
  return files.find((file) => candidates.includes(normalizePath(file.name)));
};

const resolveMappedImport = (specifier: string, imports: PlaygroundImportMap): string | undefined => {
  if (imports[specifier]) return imports[specifier];
  const prefix = Object.keys(imports)
    .filter((key) => key.endsWith("/") && specifier.startsWith(key))
    .sort((left, right) => right.length - left.length)[0];
  return prefix ? `${imports[prefix]}${specifier.slice(prefix.length)}` : undefined;
};

const rewriteImports = (
  source: string,
  filename: string,
  resolveLocal: (specifier: string) => string,
  resolveBare: (specifier: string) => string | undefined
): string => source.replace(
    /import\s*\{([^}]*)\}\s*from\s*["'](elfui|@elfui\/core|@elfui\/reactivity|@elfui\/runtime\/internal)["'];?/g,
    (_, specifiers: string, moduleName: string) => {
      const namespace = moduleName === "@elfui/runtime/internal"
        ? "globalThis.__elfuiPlayground.runtime"
        : moduleName === "@elfui/reactivity"
          ? "globalThis.__elfuiPlayground.reactivity"
        : "globalThis.__elfuiPlayground.core";
      return bindingsFor(specifiers, namespace);
    }
  )
  .replace(/(\bfrom\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (_, start: string, specifier: string, end: string) =>
    `${start}${resolveLocal(specifier)}${end}`
  )
  .replace(/(\bimport\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (_, start: string, specifier: string, end: string) =>
    `${start}${resolveLocal(specifier)}${end}`
  )
  .replace(/(\bfrom\s*["']|\bimport\s*["'])([^"']+)(["'])/g, (match, start: string, specifier: string, end: string) => {
    if (/^(?:\.{1,2}\/|\/|[a-zA-Z][\w+.-]*:)/.test(specifier)) return match;
    const resolved = resolveBare(specifier);
    if (!resolved) throw new Error(`${filename} imports ${JSON.stringify(specifier)}. Add it to Import map or use an absolute ESM URL.`);
    return `${start}${resolved}${end}`;
  }
  );

const run = async ({ activeFileId, components, files, id, imports, theme: requestedTheme }: PreviewRunMessage) => {
  try {
    currentRunId = id;
    theme.value = requestedTheme;
    message.value = "";
    mount.value?.replaceChildren();
    activeModuleUrls.forEach((url) => URL.revokeObjectURL(url));
    activeModuleUrls = [];

    (globalThis as typeof globalThis & {
      __elfuiPlayground?: { core: typeof core; reactivity: typeof reactivity; runtime: typeof runtime }
    }).__elfuiPlayground = {
      core,
      reactivity,
      runtime
    };

    const activeFile = files.find((file) => file.id === activeFileId);
    if (!activeFile) throw new Error("The selected file no longer exists in this project.");

    const moduleUrls = new Map<string, string>();
    const createModuleUrl = (file: PreviewRunMessage["files"][number], ancestry: string[] = []): string => {
      const existing = moduleUrls.get(file.id);
      if (existing) return existing;
      if (ancestry.includes(file.id)) {
        throw new Error(`Circular local import: ${[...ancestry, file.id].join(" → ")}`);
      }

      const code = rewriteImports(
        file.code,
        file.name,
        (specifier) => {
          const dependency = resolveProjectImport(file.name, specifier, files);
          if (!dependency) throw new Error(`${file.name} imports ${specifier}, but no matching project file exists.`);
          return createModuleUrl(dependency, [...ancestry, file.id]);
        },
        (specifier) => resolveMappedImport(specifier, imports)
      );
      const moduleUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      moduleUrls.set(file.id, moduleUrl);
      activeModuleUrls.push(moduleUrl);
      return moduleUrl;
    };

    const activeModule = await import(/* @vite-ignore */ createModuleUrl(activeFile));

    for (const component of components.filter((candidate) => candidate.fileId === activeFileId)) {
      const exported = activeModule[component.exportName];
      if (!exported) throw new Error(`Missing component export: ${component.exportName}`);
      core.registerComponents(exported as Parameters<typeof core.registerComponents>[0]);
      mount.value?.append(document.createElement(component.name));
    }

    postStatus({ id, type: "elfui-playground:ready" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    message.value = detail;
    postConsole("error", [error], id);
    postStatus({ id, message: detail, type: "elfui-playground:error" });
  }
};

const receive = (event: MessageEvent<PreviewRunMessage | PreviewThemeMessage>) => {
  if (event.source !== window.parent || event.origin !== parentOrigin()) return;
  if (event.data?.type === "elfui-playground:theme") {
    theme.value = event.data.theme;
    return;
  }
  if (event.data?.type === "elfui-playground:run") {
    void run(event.data);
  }
};

onMounted(() => {
  installConsoleForwarder();
  window.addEventListener("message", receive);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
});
onMounted(() => {
  const id = Number(new URLSearchParams(window.location.search).get("run"));
  postStatus({ id: Number.isFinite(id) ? id : 0, type: "elfui-playground:host-ready" });
});
onBeforeUnmount(() => {
  window.removeEventListener("message", receive);
  window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  restoreConsole();
  activeModuleUrls.forEach((url) => URL.revokeObjectURL(url));
});
</script>

<style scoped>
.preview-host {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  color: #dcecff;
  background: #08111f;
  font: 15px/1.6 Inter, ui-sans-serif, system-ui, sans-serif;
}

.preview-mount { width: min(100%, 720px); }
.preview-message { margin: 0; color: #ff9cab; }
.preview-host.light { color: #18334a; background: #f8fbfd; }
.preview-host.light .preview-message { color: #b4233b; }
</style>
