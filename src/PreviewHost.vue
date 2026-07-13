<template>
  <main class="preview-host">
    <div id="app" ref="mount" class="preview-mount"></div>
    <p v-if="message" class="preview-message">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import * as core from "@elfui/core";
import * as reactivity from "@elfui/reactivity";
import * as runtime from "@elfui/runtime/internal";
import { onBeforeUnmount, onMounted, ref } from "vue";

import type { PreviewRunMessage, PreviewStatusMessage } from "./protocol";

const mount = ref<HTMLElement | null>(null);
const message = ref("");
let activeModuleUrls: string[] = [];

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

const rewriteImports = (
  source: string,
  resolveLocal: (specifier: string) => string
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
  );

const run = async ({ activeFileId, components, files, id }: PreviewRunMessage) => {
  try {
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

      const code = rewriteImports(file.code, (specifier) => {
        const dependency = resolveProjectImport(file.name, specifier, files);
        if (!dependency) throw new Error(`${file.name} imports ${specifier}, but no matching project file exists.`);
        return createModuleUrl(dependency, [...ancestry, file.id]);
      });
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
    postStatus({ id, message: detail, type: "elfui-playground:error" });
  }
};

const receive = (event: MessageEvent<PreviewRunMessage>) => {
  if (event.source !== window.parent || event.origin !== parentOrigin() || event.data?.type !== "elfui-playground:run") return;
  void run(event.data);
};

onMounted(() => window.addEventListener("message", receive));
onMounted(() => {
  const id = Number(new URLSearchParams(window.location.search).get("run"));
  postStatus({ id: Number.isFinite(id) ? id : 0, type: "elfui-playground:host-ready" });
});
onBeforeUnmount(() => {
  window.removeEventListener("message", receive);
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
</style>
