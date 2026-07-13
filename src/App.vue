<template>
  <main class="playground-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="ElfUI Playground home">ElfUI<span>Playground</span></a>
      <div class="topbar-actions">
        <button type="button" class="quiet-button" @click="copyShareLink">{{ shareLabel }}</button>
        <a class="quiet-button docs-link" href="https://github.com/bloom-lmh/elfui-docs">Documentation</a>
        <button type="button" class="run-button" @click="compileNow">
          <span aria-hidden="true">&#9654;</span> Run
        </button>
      </div>
    </header>

    <section class="workspace" aria-label="ElfUI component playground">
      <aside class="file-panel">
        <div class="panel-heading"><span>PROJECT</span><button type="button" title="New component file" @click="createFile">+</button></div>
        <div class="file-list">
          <div v-for="file in files" :key="file.id" class="file-entry">
            <button :class="['file-row', { active: activeFileId === file.id }]" type="button" @click="openFile(file.id)">
              <span class="file-mark">TS</span>{{ file.name }}
            </button>
            <button
              v-if="files.length > 1"
              type="button"
              class="delete-file"
              :title="`Delete ${file.name}`"
              @click="deleteFile(file.id)"
            >×</button>
          </div>
        </div>
        <div class="preset-section">
          <p>STARTERS</p>
          <button
            v-for="preset in presets"
            :key="preset.id"
            type="button"
            :class="['preset-button', { active: activePreset === preset.id }]"
            @click="loadPreset(preset.id)"
          >
            {{ preset.title }}
          </button>
        </div>
        <div class="file-panel-note">Files compile independently. Select a file to preview it. Relative imports and language intelligence are next.</div>
      </aside>

      <section class="editor-area">
        <div class="tabbar">
          <span class="tab active"><i></i> {{ activeFile?.name }}</span>
          <span class="compile-state" :class="statusKind">{{ statusLabel }}</span>
        </div>
        <div ref="editorRoot" class="editor-root"></div>
      </section>

      <section class="preview-area">
        <div class="preview-toolbar">
          <div><span class="live-dot"></span> Isolated preview</div>
          <span>{{ previewOrigin ? previewOrigin.replace(/^https?:\/\//, "") : "not configured" }}</span>
        </div>
        <iframe
          v-if="previewOrigin"
          :key="previewKey"
          ref="previewFrame"
          class="preview-frame"
          :src="previewUrl"
          sandbox="allow-scripts allow-same-origin"
          title="ElfUI component preview"
        ></iframe>
        <div v-else class="preview-unavailable">Configure an isolated preview origin to run code.</div>
      </section>
    </section>

    <section class="diagnostics" aria-live="polite">
      <div class="diagnostics-heading">
        <p>COMPILER</p>
        <h1>{{ diagnostics.length ? "Diagnostics" : "Ready" }}</h1>
      </div>
      <ul v-if="diagnostics.length">
        <li v-for="diagnostic in diagnostics" :key="`${diagnostic.code}-${diagnostic.line}-${diagnostic.column}`">
          <b>{{ diagnostic.filename ? `${diagnostic.filename}: ${diagnostic.code}` : diagnostic.code }}</b>
          <span v-if="diagnostic.line">{{ diagnostic.line }}:{{ diagnostic.column ?? 1 }}</span>
          <p>{{ diagnostic.message }}</p>
        </li>
      </ul>
      <p v-else class="diagnostics-empty">Edit the active macro component. Every project file compiles in a browser Worker; the active file runs only in the isolated preview.</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import type { CompileResponse, PlaygroundDiagnostic, PlaygroundFile, PreviewStatusMessage } from "./protocol";
import { playgroundPresets } from "./presets";

type EncodedState = {
  activeFileId?: string;
  files?: PlaygroundFile[];
  // Supports links made by the former single-file Playground.
  source?: string;
};

const initialFile = (source = playgroundPresets[0].source): PlaygroundFile => ({
  id: "app",
  name: "App.elf.ts",
  source
});

(self as typeof self & { MonacoEnvironment?: { getWorker: (_: string, label: string) => Worker } }).MonacoEnvironment = {
  getWorker: (_, label) => label === "typescript" || label === "javascript" ? new TypeScriptWorker() : new EditorWorker()
};

const presets = playgroundPresets;
const activePreset = ref<(typeof playgroundPresets)[number]["id"]>();
const diagnostics = ref<PlaygroundDiagnostic[]>([]);
const editorRoot = ref<HTMLElement | null>(null);
const previewFrame = ref<HTMLIFrameElement | null>(null);
const previewOrigin = ref("");
const previewKey = ref(0);
const statusKind = ref<"compiling" | "error" | "ready">("compiling");
const shareLabel = ref("Copy link");
const files = ref<PlaygroundFile[]>([initialFile()]);
const activeFileId = ref(files.value[0].id);
const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value));

let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let compiler: Worker | undefined;
let debounce: number | undefined;
let requestId = 0;
let pendingPreview: Extract<CompileResponse, { files?: unknown }> | undefined;
let syncingEditor = false;

const previewUrl = computed(() => `${previewOrigin.value}/preview?run=${previewKey.value}`);
const statusLabel = computed(() => {
  if (statusKind.value === "compiling") return "Compiling";
  if (statusKind.value === "error") return "Error";
  return "Running";
});

const encodeState = (state: EncodedState): string => {
  const json = JSON.stringify(state);
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))));
};

const decodeState = (): EncodedState | undefined => {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get("code");
  if (!encoded) return undefined;
  try {
    const json = decodeURIComponent(Array.from(atob(encoded), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    const state = JSON.parse(json) as EncodedState;
    const projectFiles = Array.isArray(state.files)
      ? state.files.filter((file): file is PlaygroundFile =>
          typeof file?.id === "string" && typeof file.name === "string" && typeof file.source === "string"
        )
      : [];
    if (projectFiles.length) {
      return { activeFileId: state.activeFileId, files: projectFiles };
    }
    return typeof state.source === "string" ? { source: state.source } : undefined;
  } catch {
    return undefined;
  }
};

const source = (): string => editor?.getValue() ?? activeFile.value?.source ?? "";

const syncHash = () => {
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({ code: encodeState({ activeFileId: activeFileId.value, files: files.value }) }).toString();
  window.history.replaceState({}, "", url);
};

const scheduleCompile = () => {
  if (debounce) window.clearTimeout(debounce);
  debounce = window.setTimeout(compileNow, 380);
};

const reportFailure = (message: string) => {
  statusKind.value = "error";
  diagnostics.value = [{ code: "ELF_PLAYGROUND_WORKER", message, severity: "error" }];
};

const compileNow = () => {
  if (!compiler) return;
  requestId += 1;
  statusKind.value = "compiling";
  diagnostics.value = [];
  syncHash();
  compiler.postMessage({
    activeFileId: activeFileId.value,
    files: files.value.map(({ id, name, source }) => ({ id, name, source })),
    id: requestId,
    type: "compile"
  });
};

const setEditorValue = (value: string) => {
  if (!editor) return;
  syncingEditor = true;
  editor.setValue(value);
  syncingEditor = false;
};

const openFile = (id: string) => {
  const file = files.value.find((candidate) => candidate.id === id);
  if (!file || id === activeFileId.value) return;
  activeFileId.value = id;
  activePreset.value = undefined;
  setEditorValue(file.source);
  compileNow();
};

const createFile = () => {
  const number = files.value.length + 1;
  const id = `component-${Date.now()}`;
  const name = `Component${number}.elf.ts`;
  const component = `Component${number}`;
  const file: PlaygroundFile = {
    id,
    name,
    source: `import { defineHtml, html, useRef } from "@elfui/core";

const count = useRef(0);

export const ${component} = defineHtml(html\`
  <button type="button" @click=\${() => count.set(count.peek() + 1)}>
    ${component}: \${count}
  </button>
\`);`
  };
  files.value = [...files.value, file];
  activeFileId.value = id;
  activePreset.value = undefined;
  setEditorValue(file.source);
  compileNow();
};

const deleteFile = (id: string) => {
  if (files.value.length === 1) return;
  const index = files.value.findIndex((file) => file.id === id);
  if (index < 0) return;
  const remaining = files.value.filter((file) => file.id !== id);
  files.value = remaining;
  if (activeFileId.value === id) {
    const next = remaining[Math.min(index, remaining.length - 1)];
    activeFileId.value = next.id;
    setEditorValue(next.source);
  }
  activePreset.value = undefined;
  compileNow();
};

const loadPreset = (id: (typeof playgroundPresets)[number]["id"]) => {
  const preset = playgroundPresets.find((candidate) => candidate.id === id);
  if (!preset || !editor) return;
  activePreset.value = id;
  files.value = [initialFile(preset.source)];
  activeFileId.value = files.value[0].id;
  setEditorValue(preset.source);
  compileNow();
};

const receiveCompile = async ({ data }: MessageEvent<CompileResponse>) => {
  if (data.type !== "compiled" || data.id !== requestId) return;
  diagnostics.value = data.diagnostics;
  if (!data.files || !data.components || data.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    statusKind.value = "error";
    return;
  }
  pendingPreview = data;
  previewKey.value += 1;
  await nextTick();
};

const sendPreview = () => {
  if (!pendingPreview?.files || !pendingPreview.components) return;
  previewFrame.value?.contentWindow?.postMessage(
    {
      activeFileId: activeFileId.value,
      components: pendingPreview.components,
      files: pendingPreview.files,
      id: pendingPreview.id,
      type: "elfui-playground:run"
    },
    previewOrigin.value
  );
};

const receivePreview = ({ data, origin, source: messageSource }: MessageEvent<PreviewStatusMessage>) => {
  if (origin !== previewOrigin.value || messageSource !== previewFrame.value?.contentWindow || data.id !== requestId) return;
  if (data.type === "elfui-playground:host-ready") {
    sendPreview();
    return;
  }
  statusKind.value = data.type === "elfui-playground:ready" ? "ready" : "error";
  if (data.type === "elfui-playground:error") {
    diagnostics.value = [{ code: "ELF_PLAYGROUND_RUNTIME", message: data.message ?? "Preview failed", severity: "error" }];
  }
};

const copyShareLink = async () => {
  syncHash();
  try {
    await navigator.clipboard.writeText(window.location.href);
    shareLabel.value = "Copied";
  } catch {
    shareLabel.value = "Link ready";
  }
  window.setTimeout(() => { shareLabel.value = "Copy link"; }, 1400);
};

onMounted(() => {
  const configuredOrigin = import.meta.env.VITE_PLAYGROUND_PREVIEW_ORIGIN?.replace(/\/$/, "");
  const localPreviewOrigin = `${window.location.protocol}//127.0.0.1:${window.location.port}`;
  previewOrigin.value = configuredOrigin || (import.meta.env.DEV ? localPreviewOrigin : "");

  if (!previewOrigin.value || previewOrigin.value === window.location.origin) {
    reportFailure("Configure VITE_PLAYGROUND_PREVIEW_ORIGIN with an isolated preview origin.");
    return;
  }

  compiler = new Worker(new URL("./compiler.worker.ts", import.meta.url), { type: "module" });
  compiler.addEventListener("message", receiveCompile);
  compiler.addEventListener("error", (event) => reportFailure(event.message || "The compiler Worker could not start."));
  compiler.addEventListener("messageerror", () => reportFailure("The compiler Worker returned an unreadable response."));
  window.addEventListener("message", receivePreview);

  monaco.editor.defineTheme("elfui-night", {
    base: "vs-dark",
    inherit: true,
    colors: {
      "editor.background": "#07111f",
      "editor.lineHighlightBackground": "#0b1c2d",
      "editorCursor.foreground": "#46d8ce",
      "editor.selectionBackground": "#14607180",
      "editorLineNumber.foreground": "#476277",
      "editorLineNumber.activeForeground": "#8fb4cc"
    },
    rules: []
  });
  const shared = decodeState();
  files.value = shared?.files?.length ? shared.files : [initialFile(shared?.source)];
  activeFileId.value = files.value.some((file) => file.id === shared?.activeFileId)
    ? shared!.activeFileId!
    : files.value[0].id;
  const restoredFile = files.value.find((file) => file.id === activeFileId.value) ?? files.value[0];
  activePreset.value = files.value.length === 1
    ? presets.find((preset) => preset.source === restoredFile.source)?.id
    : undefined;
  editor = monaco.editor.create(editorRoot.value ?? document.body, {
    automaticLayout: true,
    fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
    fontSize: 14,
    lineHeight: 24,
    minimap: { enabled: false },
    padding: { top: 18, bottom: 18 },
    scrollBeyondLastLine: false,
    theme: "elfui-night",
    value: restoredFile.source,
    language: "typescript"
  });
  editor.onDidChangeModelContent(() => {
    if (syncingEditor) return;
    const file = activeFile.value;
    if (!file) return;
    files.value = files.value.map((candidate) => candidate.id === file.id ? { ...candidate, source: source() } : candidate);
    activePreset.value = undefined;
    scheduleCompile();
  });
  compileNow();
});

onBeforeUnmount(() => {
  if (debounce) window.clearTimeout(debounce);
  compiler?.terminate();
  editor?.dispose();
  window.removeEventListener("message", receivePreview);
});
</script>

<style scoped>
.playground-shell { min-height: 100vh; color: #d5e7f4; background: #07111f; }
.topbar { display: flex; align-items: center; justify-content: space-between; min-height: 64px; padding: 0 26px; border-bottom: 1px solid #193044; background: rgba(5, 14, 25, .92); }
.brand { color: #f2fbff; font: 800 20px/1 Georgia, serif; text-decoration: none; }
.brand span { margin-left: 9px; color: #49d9ca; font: 700 12px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.topbar-actions { display: flex; align-items: center; gap: 9px; }
.quiet-button, .run-button { min-height: 34px; padding: 0 12px; border: 1px solid #254158; border-radius: 5px; color: #b5cddd; background: #0b1b2d; font: 700 12px/1 Inter, ui-sans-serif, system-ui, sans-serif; cursor: pointer; text-decoration: none; }
.quiet-button:hover { border-color: #4380a2; color: #e7f8ff; }
.run-button { border-color: #32c7bf; color: #052125; background: #45d8cf; }
.run-button span { margin-right: 5px; font-size: 10px; }
.workspace { display: grid; grid-template-columns: 220px minmax(440px, 1.12fr) minmax(360px, .88fr); min-height: calc(100vh - 64px - 132px); }
.file-panel, .editor-area, .preview-area { min-width: 0; border-right: 1px solid #193044; }
.file-panel { display: flex; flex-direction: column; background: #081522; }
.panel-heading, .tabbar, .preview-toolbar { display: flex; align-items: center; min-height: 43px; padding: 0 14px; border-bottom: 1px solid #193044; color: #7d9ab0; font: 750 11px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .1em; }
.panel-heading { justify-content: space-between; }
.panel-heading button { border: 0; color: #72adc9; background: transparent; font-size: 18px; cursor: pointer; }
.file-entry { display: flex; align-items: stretch; }
.file-row { display: flex; flex: 1; align-items: center; gap: 8px; width: 100%; min-width: 0; min-height: 35px; padding: 0 14px; border: 0; border-left: 2px solid transparent; color: #9fb8ca; background: transparent; text-align: left; font: 650 12px/1 "JetBrains Mono", ui-monospace, monospace; }
.file-row.active { border-left-color: #45d8cf; color: #effaff; background: #0e2233; }
.file-mark { color: #49d9ca; font-size: 9px; font-weight: 900; }
.delete-file { width: 31px; border: 0; color: #5c7b91; background: transparent; font-size: 16px; cursor: pointer; }
.delete-file:hover { color: #ff9daa; background: #3a172333; }
.preset-section { padding: 24px 12px; }
.preset-section p { margin: 0 0 10px; color: #547187; font: 750 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .12em; }
.preset-button { display: block; width: 100%; margin-bottom: 5px; padding: 9px 10px; border: 1px solid transparent; border-radius: 4px; color: #91aabd; background: transparent; text-align: left; font: 650 12px/1 Inter, ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
.preset-button:hover, .preset-button.active { border-color: #24455c; color: #eaf9ff; background: #0d2031; }
.file-panel-note { margin: auto 14px 16px; color: #59758a; font-size: 11px; line-height: 1.55; }
.editor-area { display: grid; grid-template-rows: 43px minmax(0, 1fr); }
.tabbar { justify-content: space-between; padding-left: 18px; }
.tab { color: #c0d7e6; font: 650 12px/1 "JetBrains Mono", ui-monospace, monospace; }
.tab i { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 2px; background: #49d9ca; }
.compile-state { padding: 5px 8px; border-radius: 999px; font: 750 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .04em; }
.compile-state.compiling { color: #f3c66a; background: #654b1e55; }
.compile-state.ready { color: #54e7ce; background: #12645c44; }
.compile-state.error { color: #ff9daa; background: #6f263544; }
.editor-root { min-height: 0; }
.preview-area { display: grid; grid-template-rows: 43px minmax(0, 1fr); border-right: 0; background: #091726; }
.preview-toolbar { justify-content: space-between; color: #a2bccd; letter-spacing: 0; }
.preview-toolbar > span { color: #648299; font: 600 10px/1 "JetBrains Mono", ui-monospace, monospace; }
.live-dot { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 999px; background: #49d9ca; box-shadow: 0 0 12px #49d9ca; }
.preview-frame { width: 100%; height: 100%; border: 0; background: #08111f; }
.preview-unavailable { display: grid; place-items: center; padding: 30px; color: #ffafba; text-align: center; font-size: 13px; line-height: 1.6; }
.diagnostics { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px; min-height: 132px; padding: 23px 26px; border-top: 1px solid #193044; background: #081522; }
.diagnostics-heading p { margin: 0 0 9px; color: #49d9ca; font: 800 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .13em; }
.diagnostics-heading h1 { margin: 0; color: #e8f7ff; font-size: 20px; }
.diagnostics ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.diagnostics li { display: grid; grid-template-columns: max-content max-content minmax(0, 1fr); gap: 10px; align-items: start; padding: 9px 11px; border: 1px solid #572535; border-radius: 5px; color: #ffb1bb; background: #3a172333; font-size: 12px; }
.diagnostics li b, .diagnostics li span { font: 700 11px/1.5 "JetBrains Mono", ui-monospace, monospace; }
.diagnostics li p, .diagnostics-empty { margin: 0; color: #91aabd; line-height: 1.55; }
@media (max-width: 980px) { .workspace { grid-template-columns: 190px minmax(0, 1fr); } .preview-area { grid-column: 2; min-height: 420px; border-top: 1px solid #193044; } .diagnostics { grid-template-columns: 1fr; gap: 16px; } }
@media (max-width: 680px) { .topbar { padding: 0 14px; } .brand span, .docs-link { display: none; } .workspace { display: block; } .file-panel { min-height: 150px; border-bottom: 1px solid #193044; } .file-panel-note { display: none; } .editor-area, .preview-area { min-height: 430px; border-bottom: 1px solid #193044; } .diagnostics { padding: 20px 16px; } .diagnostics li { grid-template-columns: 1fr; gap: 4px; } }
</style>
