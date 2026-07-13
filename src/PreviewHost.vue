<template>
  <main class="preview-host">
    <div ref="mount" class="preview-mount"></div>
    <p v-if="message" class="preview-message">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import * as core from "@elfui/core";
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

  // Files are concatenated before previewing, so `var` intentionally permits
  // repeated imports of the same helper from separate project files.
  return `var { ${bindings.join(", ")} } = ${namespace};`;
};

const rewriteImports = (source: string): string =>
  source.replace(
    /import\s*\{([^}]*)\}\s*from\s*["'](elfui|@elfui\/core|@elfui\/runtime\/internal)["'];?/g,
    (_, specifiers: string, moduleName: string) => {
      const namespace = moduleName === "@elfui/runtime/internal"
        ? "globalThis.__elfuiPlayground.runtime"
        : "globalThis.__elfuiPlayground.core";
      return bindingsFor(specifiers, namespace);
    }
  );

const run = async ({ activeFileId, components, files, id }: PreviewRunMessage) => {
  try {
    message.value = "";
    mount.value?.replaceChildren();
    activeModuleUrls.forEach((url) => URL.revokeObjectURL(url));
    activeModuleUrls = [];

    (globalThis as typeof globalThis & { __elfuiPlayground?: { core: typeof core; runtime: typeof runtime } }).__elfuiPlayground = {
      core,
      runtime
    };

    const modules = new Map<string, Record<string, unknown>>();
    for (const file of files) {
      const moduleUrl = URL.createObjectURL(new Blob([rewriteImports(file.code)], { type: "text/javascript" }));
      activeModuleUrls.push(moduleUrl);
      modules.set(file.id, await import(/* @vite-ignore */ moduleUrl));
    }

    for (const component of components.filter((candidate) => candidate.fileId === activeFileId)) {
      const exported = modules.get(component.fileId)?.[component.exportName];
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
