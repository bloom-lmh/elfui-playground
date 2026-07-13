<template>
  <main :class="['playground-shell', theme]">
    <header class="topbar">
      <a class="brand" href="/" aria-label="ElfUI Playground home">ElfUI<span>Playground</span></a>
      <div class="topbar-actions">
        <button type="button" class="quiet-button" @click="formatActiveFile">{{ formatLabel }}</button>
        <button type="button" class="quiet-button" :aria-pressed="autoSave" title="Keep the workspace state in the shareable URL" @click="toggleAutoSave">Auto save {{ autoSave ? "on" : "off" }}</button>
        <button type="button" class="quiet-button" :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme">{{ theme === "dark" ? "Light theme" : "Dark theme" }}</button>
        <button type="button" class="quiet-button" @click="copyShareLink">{{ shareLabel }}</button>
        <button type="button" class="quiet-button" @click="exportProject">{{ exportLabel }}</button>
        <button type="button" class="quiet-button" @click="importInput?.click()">{{ importLabel }}</button>
        <input ref="importInput" hidden type="file" accept="application/json,.json" @change="importProject" />
        <a class="quiet-button docs-link" href="https://github.com/bloom-lmh/elfui-docs">Documentation</a>
        <button type="button" class="run-button" @click="compileNow">
          <span aria-hidden="true">&#9654;</span> Run
        </button>
      </div>
    </header>

    <section class="workspace" aria-label="ElfUI component playground">
      <aside class="file-panel">
        <div class="panel-heading"><span>PROJECT</span><button type="button" title="New TypeScript file" @click="createFile">+</button></div>
        <div class="file-list">
          <template v-for="item in projectTreeItems" :key="item.id">
            <button
              v-if="item.kind === 'folder'"
              class="folder-row"
              type="button"
              :aria-expanded="!item.collapsed"
              :style="{ paddingLeft: `${14 + item.depth * 16}px` }"
              @click="toggleFolder(item.id)"
            >
              <span aria-hidden="true">{{ item.collapsed ? '›' : '⌄' }}</span>{{ item.name }}
            </button>
            <div v-else class="file-entry">
              <button
                v-if="editingFileId !== item.file.id"
                :class="['file-row', { active: activeFileId === item.file.id }]"
                :style="{ paddingLeft: `${14 + item.depth * 16}px` }"
                type="button"
                @click="openFile(item.file.id)"
                @dblclick="startRename(item.file)"
              >
                <span class="file-mark">TS</span>{{ item.file.name.split('/').at(-1) }}
              </button>
              <input
                v-else
                v-model="fileNameDraft"
                ref="renameInputs"
                class="rename-file"
                :aria-label="`Rename ${item.file.name}`"
                @blur="commitRename(item.file.id)"
                @keydown.enter.prevent="commitRename(item.file.id)"
                @keydown.esc.prevent="cancelRename"
              />
              <button v-if="editingFileId !== item.file.id" type="button" class="rename-file-button" title="Rename file" @click="startRename(item.file)">Rename</button>
              <button
                v-if="files.length > 1 && editingFileId !== item.file.id"
                type="button"
                class="delete-file"
                :title="`Delete ${item.file.name}`"
                @click="deleteFile(item.file.id)"
              >×</button>
            </div>
          </template>
        </div>
        <p v-if="fileActionError" class="file-action-error">{{ fileActionError }}</p>
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
        <div class="file-panel-note">Files compile as project modules. Use relative imports such as <code>./Component2</code>; select a file to preview it.</div>
      </aside>

      <section class="editor-area">
        <div class="tabbar">
          <span class="tab active"><i></i> {{ activeFile?.name }}</span>
          <div class="editor-actions">
            <label class="entry-select">Entry
              <select v-model="entryFileId" aria-label="Preview entry file" @change="compileNow">
                <option v-for="file in files" :key="file.id" :value="file.id">{{ file.name }}</option>
              </select>
            </label>
            <span class="compile-state" :class="statusKind">{{ statusLabel }}</span>
          </div>
        </div>
        <div ref="editorRoot" class="editor-root"></div>
      </section>

      <section class="preview-area">
        <div class="preview-toolbar">
          <div class="output-tabs" role="tablist" aria-label="Playground output">
            <button :class="{ active: outputMode === 'preview' }" type="button" role="tab" @click="outputMode = 'preview'">
              <span class="live-dot"></span> Preview
            </button>
            <button :class="{ active: outputMode === 'compiled' }" type="button" role="tab" @click="outputMode = 'compiled'">Compiled JS</button>
          </div>
          <span>{{ previewOrigin ? previewOrigin.replace(/^https?:\/\//, "") : "not configured" }}</span>
        </div>
        <iframe
          v-if="outputMode === 'preview' && previewOrigin"
          :key="previewKey"
          ref="previewFrame"
          class="preview-frame"
          :src="previewUrl"
          sandbox="allow-scripts allow-same-origin"
          title="ElfUI component preview"
        ></iframe>
        <pre v-else-if="outputMode === 'compiled'" class="compiled-output"><code>{{ compiledSource || "Compile the project to inspect the generated JavaScript." }}</code></pre>
        <div v-else class="preview-unavailable">Configure an isolated preview origin to run code.</div>
      </section>
    </section>

    <section class="diagnostics" aria-live="polite">
      <div class="diagnostics-heading">
        <p>COMPILER</p>
        <h1>{{ diagnostics.length ? "Diagnostics" : "Ready" }}</h1>
      </div>
      <ul v-if="diagnostics.length">
        <li v-for="diagnostic in diagnostics" :key="`${diagnostic.filename}-${diagnostic.code}-${diagnostic.line}-${diagnostic.column}`" @click="showDiagnostic(diagnostic)">
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

import type {
  CompiledPlaygroundFile,
  CompileResponse,
  PlaygroundDiagnostic,
  PlaygroundFile,
  PlaygroundTheme,
  PreviewThemeMessage,
  PreviewStatusMessage
} from "./protocol";
import { elfuiTypeDefinitions } from "./elfui-types";
import { playgroundPresets } from "./presets";

type EncodedState = {
  activeFileId?: string;
  entryFileId?: string;
  files?: PlaygroundFile[];
  version?: 1;
  // Supports links made by the former single-file Playground.
  source?: string;
};

type ProjectTreeItem =
  | { collapsed: boolean; depth: number; id: string; kind: "folder"; name: string }
  | { depth: number; file: PlaygroundFile; id: string; kind: "file" };

type ProjectTreeFolder = {
  files: PlaygroundFile[];
  folders: Map<string, ProjectTreeFolder>;
};

const initialFile = (source = playgroundPresets.find((preset) => preset.id === "counter")!.source): PlaygroundFile => ({
  id: "app",
  name: "App.ts",
  source
});

const initialProject = (): { activeFileId: string; entryFileId: string; files: PlaygroundFile[] } => {
  const application = playgroundPresets.find((preset) => preset.id === "application")?.project;
  return application
    ? {
        activeFileId: application.activeFileId,
        entryFileId: application.entryFileId,
        files: application.files.map((file) => ({ ...file }))
      }
    : { activeFileId: "app", entryFileId: "app", files: [initialFile()] };
};

const initialAutoSave = (): boolean => {
  try {
    return window.localStorage.getItem("elfui-playground:auto-save") !== "false";
  } catch {
    return true;
  }
};

const initialTheme = (): PlaygroundTheme => {
  try {
    return window.localStorage.getItem("elfui-playground:theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

const normalizeProjectPath = (value: string) => value.replace(/\\/g, "/").replace(/^\.\//, "");

const isValidProjectPath = (value: string): boolean =>
  value.endsWith(".ts") && !value.includes("..") && !value.includes("\\") && !value.startsWith("/") &&
  value.split("/").every((segment) => Boolean(segment) && segment !== ".");

const resolveLocalImport = (from: string, specifier: string, project: PlaygroundFile[]): PlaygroundFile | undefined => {
  const fromParts = normalizeProjectPath(from).split("/");
  fromParts.pop();
  const normalized: string[] = [];

  for (const part of [...fromParts, ...specifier.split("/")]) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }

  const path = normalized.join("/");
  return project.find((file) => [path, `${path}.ts`, `${path}/index.ts`].includes(normalizeProjectPath(file.name)));
};

const relativeImport = (from: string, target: string, includeExtension: boolean): string => {
  const fromParts = normalizeProjectPath(from).split("/");
  fromParts.pop();
  const targetParts = normalizeProjectPath(target).split("/");
  while (fromParts[0] && fromParts[0] === targetParts[0]) {
    fromParts.shift();
    targetParts.shift();
  }
  const path = [...fromParts.map(() => ".."), ...targetParts].join("/") || ".";
  const withPrefix = path.startsWith(".") ? path : `./${path}`;
  return includeExtension ? withPrefix : withPrefix.replace(/\.ts$/, "");
};

const updateImportsForRename = (project: PlaygroundFile[], renamedId: string, renamedName: string): PlaygroundFile[] => project.map((file) => {
  const nextName = file.id === renamedId ? renamedName : file.name;
  const source = file.source.replace(/(\b(?:from|import)\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (match, start, specifier, end) => {
    const target = resolveLocalImport(file.name, specifier, project);
    if (!target || (file.id !== renamedId && target.id !== renamedId)) return match;
    const targetName = target.id === renamedId ? renamedName : target.name;
    return `${start}${relativeImport(nextName, targetName, specifier.endsWith(".ts"))}${end}`;
  });
  return { ...file, name: nextName, source };
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
const formatLabel = ref("Format");
const autoSave = ref(initialAutoSave());
const theme = ref<PlaygroundTheme>(initialTheme());
const previewTheme = ref<PlaygroundTheme>(theme.value);
const exportLabel = ref("Export");
const importLabel = ref("Import");
const outputMode = ref<"preview" | "compiled">("preview");
const compiledFiles = ref<CompiledPlaygroundFile[]>([]);
const startingProject = initialProject();
const files = ref<PlaygroundFile[]>(startingProject.files);
const activeFileId = ref(startingProject.activeFileId);
const entryFileId = ref(startingProject.entryFileId);
const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value));
const collapsedFolders = ref<Set<string>>(new Set());
const editingFileId = ref<string>();
const fileNameDraft = ref("");
const fileActionError = ref("");
const renameInputs = ref<HTMLInputElement[]>([]);
const importInput = ref<HTMLInputElement | null>(null);

let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let compiler: Worker | undefined;
let debounce: number | undefined;
let requestId = 0;
let pendingPreview: Extract<CompileResponse, { files?: unknown }> | undefined;
const editorModels = new Map<string, monaco.editor.ITextModel>();

const previewUrl = computed(() => `${previewOrigin.value}/preview?run=${previewKey.value}&theme=${previewTheme.value}`);
const compiledSource = computed(() => compiledFiles.value.find((file) => file.id === activeFileId.value)?.code ?? "");
const projectTreeItems = computed<ProjectTreeItem[]>(() => {
  const root: ProjectTreeFolder = { files: [], folders: new Map() };

  for (const file of files.value) {
    const parts = normalizeProjectPath(file.name).split("/");
    const filename = parts.pop();
    if (!filename) continue;
    let folder = root;
    for (const part of parts) {
      let next = folder.folders.get(part);
      if (!next) {
        next = { files: [], folders: new Map() };
        folder.folders.set(part, next);
      }
      folder = next;
    }
    folder.files.push(file);
  }

  const items: ProjectTreeItem[] = [];
  const visit = (folder: ProjectTreeFolder, path: string, depth: number) => {
    for (const [name, child] of [...folder.folders.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const id = path ? `${path}/${name}` : name;
      const collapsed = collapsedFolders.value.has(id);
      items.push({ collapsed, depth, id, kind: "folder", name });
      if (!collapsed) visit(child, id, depth + 1);
    }
    for (const file of [...folder.files].sort((left, right) => left.name.localeCompare(right.name))) {
      items.push({ depth, file, id: file.id, kind: "file" });
    }
  };

  visit(root, "", 0);
  return items;
});
const statusLabel = computed(() => {
  if (statusKind.value === "compiling") return "Compiling";
  if (statusKind.value === "error") return "Error";
  return "Running";
});

const toggleFolder = (id: string) => {
  const next = new Set(collapsedFolders.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedFolders.value = next;
};

const revealFilePath = (filename: string) => {
  const folders = normalizeProjectPath(filename).split("/").slice(0, -1);
  if (!folders.length) return;
  const next = new Set(collapsedFolders.value);
  let path = "";
  for (const folder of folders) {
    path = path ? `${path}/${folder}` : folder;
    next.delete(path);
  }
  collapsedFolders.value = next;
};

const encodeState = (state: EncodedState): string => {
  const json = JSON.stringify(state);
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))));
};

type ProjectState = Required<Pick<EncodedState, "activeFileId" | "entryFileId" | "files">>;

const parseProjectState = (state: EncodedState): ProjectState | undefined => {
  if (!Array.isArray(state.files) || state.files.length === 0 || state.files.length > 64) return undefined;
  if (!state.files.every((file): file is PlaygroundFile =>
    typeof file?.id === "string" && file.id.length > 0 && file.id.length <= 100 &&
    typeof file.name === "string" && file.name.length > 0 && file.name.length <= 240 &&
    isValidProjectPath(file.name) &&
    typeof file.source === "string" && file.source.length <= 500_000
  )) return undefined;
  if (new Set(state.files.map((file) => file.id)).size !== state.files.length) return undefined;
  if (new Set(state.files.map((file) => file.name)).size !== state.files.length) return undefined;
  const activeFileId = state.files.some((file) => file.id === state.activeFileId)
    ? state.activeFileId!
    : state.files[0].id;
  const entryFileId = state.files.some((file) => file.id === state.entryFileId)
    ? state.entryFileId!
    : activeFileId;
  return { activeFileId, entryFileId, files: state.files.map((file) => ({ ...file })) };
};

const decodeState = (): EncodedState | undefined => {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get("code");
  if (!encoded) return undefined;
  try {
    const json = decodeURIComponent(Array.from(atob(encoded), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    const state = JSON.parse(json) as EncodedState;
    const project = parseProjectState(state);
    if (project) return project;
    return typeof state.source === "string" ? { source: state.source } : undefined;
  } catch {
    return undefined;
  }
};

const source = (): string => editor?.getValue() ?? activeFile.value?.source ?? "";

const modelUri = (file: PlaygroundFile) => monaco.Uri.parse(
  `file:///playground/${file.name.split("/").map(encodeURIComponent).join("/")}`
);

const projectModel = (file: PlaygroundFile): monaco.editor.ITextModel => {
  const existing = editorModels.get(file.id);
  if (existing) return existing;
  const model = monaco.editor.createModel(file.source, "typescript", modelUri(file));
  editorModels.set(file.id, model);
  return model;
};

const syncProjectModels = () => files.value.forEach(projectModel);

const activateFileModel = (file: PlaygroundFile) => editor?.setModel(projectModel(file));

const formatTypeScriptMessage = (message: string | { messageText: string; next?: unknown[] }): string => {
  if (typeof message === "string") return message;
  const details = (message.next ?? [])
    .map((next) => formatTypeScriptMessage(next as { messageText: string; next?: unknown[] }))
    .filter(Boolean);
  return [message.messageText, ...details].join("\n");
};

const macroTemplateRanges = (source: string): Array<{ end: number; start: number }> => {
  const ranges: Array<{ end: number; start: number }> = [];
  const macro = /\bhtml\s*`/g;
  for (let match = macro.exec(source); match; match = macro.exec(source)) {
    const start = match.index;
    let cursor = macro.lastIndex;
    while (cursor < source.length) {
      if (source[cursor] === "`" && source[cursor - 1] !== "\\") {
        ranges.push({ end: cursor + 1, start });
        cursor += 1;
        break;
      }
      cursor += 1;
    }
    macro.lastIndex = cursor;
  }
  return ranges;
};

const collectTypeScriptDiagnostics = async (compileId: number): Promise<PlaygroundDiagnostic[]> => {
  try {
    syncProjectModels();
    const workerFactory = await monaco.languages.typescript.getTypeScriptWorker();
    if (compileId !== requestId) return [];
    const models = files.value.map(projectModel);
    const worker = await workerFactory(...models.map((model) => model.uri));
    const grouped = await Promise.all(files.value.map(async (file) => {
      const model = projectModel(file);
      const templateRanges = macroTemplateRanges(file.source);
      const [syntactic, semantic] = await Promise.all([
        worker.getSyntacticDiagnostics(model.uri.toString()),
        worker.getSemanticDiagnostics(model.uri.toString())
      ]);
      return [...syntactic, ...semantic]
        .filter((diagnostic) => diagnostic.category === 0 || diagnostic.category === 1)
        // Macro template contents are validated by @elfui/compiler. Monaco's raw
        // TypeScript parser can mistake the embedded HTML for TS after a model swap.
        .filter((diagnostic) => !templateRanges.some((range) =>
          (diagnostic.start ?? 0) >= range.start && (diagnostic.start ?? 0) <= range.end
        ))
        .map((diagnostic) => {
          const position = model.getPositionAt(diagnostic.start ?? 0);
          return {
            code: `TS${diagnostic.code}`,
            column: position.column,
            filename: file.name,
            line: position.lineNumber,
            message: formatTypeScriptMessage(diagnostic.messageText),
            severity: diagnostic.category === 0 ? "warning" : "error"
          } satisfies PlaygroundDiagnostic;
        });
    }));
    return grouped.flat();
  } catch {
    // Monaco still reports diagnostics in the editor if its language worker is unavailable.
    return [];
  }
};

const syncHash = (force = false) => {
  if (!autoSave.value && !force) return;
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({ code: encodeState({
    activeFileId: activeFileId.value,
    entryFileId: entryFileId.value,
    files: files.value,
    version: 1
  }) }).toString();
  window.history.replaceState({}, "", url);
};

const toggleAutoSave = () => {
  autoSave.value = !autoSave.value;
  try {
    window.localStorage.setItem("elfui-playground:auto-save", String(autoSave.value));
  } catch {
    // The Playground still works if storage is unavailable in a privacy-restricted browser.
  }
  if (autoSave.value) syncHash();
};

const editorTheme = () => theme.value === "light" ? "elfui-day" : "elfui-night";

const sendPreviewTheme = () => {
  const message: PreviewThemeMessage = { theme: theme.value, type: "elfui-playground:theme" };
  previewFrame.value?.contentWindow?.postMessage(message, previewOrigin.value);
};

const toggleTheme = () => {
  theme.value = theme.value === "dark" ? "light" : "dark";
  try {
    window.localStorage.setItem("elfui-playground:theme", theme.value);
  } catch {
    // Theme switching remains available in privacy-restricted browsers.
  }
  monaco.editor.setTheme(editorTheme());
  sendPreviewTheme();
};

const replaceProject = (project: ProjectState) => {
  editorModels.forEach((model) => model.dispose());
  editorModels.clear();
  collapsedFolders.value = new Set();
  files.value = project.files;
  activeFileId.value = project.activeFileId;
  entryFileId.value = project.entryFileId;
  syncProjectModels();
  activePreset.value = undefined;
  fileActionError.value = "";
  cancelRename();
  const selected = files.value.find((file) => file.id === activeFileId.value) ?? files.value[0];
  activateFileModel(selected);
  compileNow();
};

const scheduleCompile = () => {
  if (debounce) window.clearTimeout(debounce);
  debounce = window.setTimeout(compileNow, 380);
};

const updateEditorMarkers = () => {
  const model = editor?.getModel();
  const file = activeFile.value;
  if (!model || !file) return;
  monaco.editor.setModelMarkers(
    model,
    "elfui-playground",
    diagnostics.value
      .filter((diagnostic) => diagnostic.filename === file.name && diagnostic.line)
      .map((diagnostic) => ({
        endColumn: diagnostic.column ? diagnostic.column + 1 : 2,
        endLineNumber: diagnostic.line!,
        message: diagnostic.message,
        severity: diagnostic.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
        startColumn: diagnostic.column ?? 1,
        startLineNumber: diagnostic.line!
      }))
  );
};

const reportFailure = (message: string) => {
  statusKind.value = "error";
  diagnostics.value = [{ code: "ELF_PLAYGROUND_WORKER", message, severity: "error" }];
  updateEditorMarkers();
};

const compileNow = () => {
  if (!compiler) return;
  requestId += 1;
  statusKind.value = "compiling";
  diagnostics.value = [];
  compiledFiles.value = [];
  updateEditorMarkers();
  syncHash();
  compiler.postMessage({
    activeFileId: entryFileId.value,
    files: files.value.map(({ id, name, source }) => ({ id, name, source })),
    id: requestId,
    type: "compile"
  });
};

const openFile = (id: string) => {
  const file = files.value.find((candidate) => candidate.id === id);
  if (!file || id === activeFileId.value) return;
  activeFileId.value = id;
  activePreset.value = undefined;
  activateFileModel(file);
  updateEditorMarkers();
};

const startRename = (file: PlaygroundFile) => {
  fileActionError.value = "";
  editingFileId.value = file.id;
  fileNameDraft.value = file.name;
  void nextTick(() => renameInputs.value[0]?.focus());
};

const cancelRename = () => {
  editingFileId.value = undefined;
  fileNameDraft.value = "";
};

const commitRename = (id: string) => {
  // Pressing Enter moves focus away from the input, which subsequently emits blur.
  // Ignore that second event once the successful commit has closed rename mode.
  if (editingFileId.value !== id) return;

  const current = files.value.find((file) => file.id === id);
  if (!current) return cancelRename();
  const rawName = fileNameDraft.value.trim().replace(/^\.\/+/, "").replace(/\/{2,}/g, "/");
  const name = rawName.endsWith(".ts") ? rawName : `${rawName}.ts`;
  if (!rawName || !isValidProjectPath(name)) {
    fileActionError.value = "Use a relative TypeScript filename with valid path segments.";
    return;
  }
  if (files.value.some((file) => file.id !== id && file.name === name)) {
    fileActionError.value = `A file named ${name} already exists.`;
    return;
  }
  if (name === current.name) return cancelRename();

  const updatedFiles = updateImportsForRename(files.value, id, name);
  for (const file of updatedFiles) {
    const previous = files.value.find((candidate) => candidate.id === file.id);
    if (!previous || previous.name !== file.name || previous.source !== file.source) {
      editorModels.get(file.id)?.dispose();
      editorModels.delete(file.id);
    }
  }
  files.value = updatedFiles;
  revealFilePath(name);
  syncProjectModels();
  if (activeFileId.value === id) activateFileModel(updatedFiles.find((file) => file.id === id)!);
  fileActionError.value = "";
  cancelRename();
  compileNow();
};

const showDiagnostic = async (diagnostic: PlaygroundDiagnostic) => {
  const file = diagnostic.filename ? files.value.find((candidate) => candidate.name === diagnostic.filename) : undefined;
  if (file && file.id !== activeFileId.value) {
    activeFileId.value = file.id;
    activePreset.value = undefined;
    activateFileModel(file);
    await nextTick();
  }
  if (!diagnostic.line || !editor) return;
  const column = diagnostic.column ?? 1;
  editor.revealPositionInCenter({ column, lineNumber: diagnostic.line });
  editor.setPosition({ column, lineNumber: diagnostic.line });
  editor.focus();
};

const createFile = () => {
  const number = files.value.length + 1;
  const id = `component-${Date.now()}`;
  const name = `Component${number}.ts`;
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
  activateFileModel(file);
  startRename(file);
  compileNow();
};

const deleteFile = (id: string) => {
  if (files.value.length === 1) return;
  const index = files.value.findIndex((file) => file.id === id);
  if (index < 0) return;
  const remaining = files.value.filter((file) => file.id !== id);
  editorModels.get(id)?.dispose();
  editorModels.delete(id);
  files.value = remaining;
  if (entryFileId.value === id) entryFileId.value = remaining[Math.min(index, remaining.length - 1)].id;
  if (activeFileId.value === id) {
    const next = remaining[Math.min(index, remaining.length - 1)];
    activeFileId.value = next.id;
    activateFileModel(next);
  }
  activePreset.value = undefined;
  compileNow();
};

const loadPreset = (id: (typeof playgroundPresets)[number]["id"]) => {
  const preset = playgroundPresets.find((candidate) => candidate.id === id);
  if (!preset || !editor) return;
  activePreset.value = id;
  editorModels.forEach((model) => model.dispose());
  editorModels.clear();
  collapsedFolders.value = new Set();
  files.value = preset.project
    ? preset.project.files.map((file) => ({ ...file }))
    : [initialFile(preset.source)];
  activeFileId.value = preset.project?.activeFileId ?? files.value[0].id;
  entryFileId.value = preset.project?.entryFileId ?? activeFileId.value;
  syncProjectModels();
  const selected = files.value.find((file) => file.id === activeFileId.value) ?? files.value[0];
  activateFileModel(selected);
  compileNow();
};

const receiveCompile = async ({ data }: MessageEvent<CompileResponse>) => {
  if (data.type !== "compiled" || data.id !== requestId) return;
  const typeDiagnostics = data.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? []
    : await collectTypeScriptDiagnostics(data.id);
  if (data.id !== requestId) return;
  diagnostics.value = [...data.diagnostics, ...typeDiagnostics];
  updateEditorMarkers();
  if (!data.files || !data.components || diagnostics.value.some((diagnostic) => diagnostic.severity === "error")) {
    statusKind.value = "error";
    return;
  }
  compiledFiles.value = data.files;
  pendingPreview = data;
  previewTheme.value = theme.value;
  previewKey.value += 1;
  await nextTick();
};

const sendPreview = () => {
  if (!pendingPreview?.files || !pendingPreview.components) return;
  previewFrame.value?.contentWindow?.postMessage(
    {
      activeFileId: entryFileId.value,
      components: pendingPreview.components,
      files: pendingPreview.files,
      id: pendingPreview.id,
      theme: theme.value,
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
  syncHash(true);
  try {
    await navigator.clipboard.writeText(window.location.href);
    shareLabel.value = "Copied";
  } catch {
    shareLabel.value = "Link ready";
  }
  window.setTimeout(() => { shareLabel.value = "Copy link"; }, 1400);
};

const formatActiveFile = async () => {
  const action = editor?.getAction("editor.action.formatDocument");
  if (!action) {
    fileActionError.value = "The TypeScript formatter is not ready yet.";
    return;
  }
  try {
    await action.run();
    formatLabel.value = "Formatted";
    window.setTimeout(() => { formatLabel.value = "Format"; }, 1400);
  } catch (error) {
    fileActionError.value = error instanceof Error ? error.message : "Unable to format this file.";
  }
};

const exportProject = () => {
  const project = {
    activeFileId: activeFileId.value,
    entryFileId: entryFileId.value,
    files: files.value,
    version: 1
  } satisfies EncodedState;
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "elfui-playground.json";
  link.click();
  URL.revokeObjectURL(url);
  exportLabel.value = "Exported";
  window.setTimeout(() => { exportLabel.value = "Export"; }, 1400);
};

const importProject = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > 2_000_000) {
    fileActionError.value = "The project file is too large to import (maximum 2 MB).";
    return;
  }
  try {
    const project = parseProjectState(JSON.parse(await file.text()) as EncodedState);
    if (!project) throw new Error("The file does not contain a valid ElfUI TypeScript project.");
    replaceProject(project);
    importLabel.value = "Imported";
    window.setTimeout(() => { importLabel.value = "Import"; }, 1400);
  } catch (error) {
    fileActionError.value = error instanceof Error ? error.message : "Unable to import this project file.";
    importLabel.value = "Import failed";
    window.setTimeout(() => { importLabel.value = "Import"; }, 1800);
  }
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
  monaco.editor.defineTheme("elfui-day", {
    base: "vs",
    inherit: true,
    colors: {
      "editor.background": "#f8fbfd",
      "editor.lineHighlightBackground": "#e9f3f8",
      "editorCursor.foreground": "#137f84",
      "editor.selectionBackground": "#b9e5e480",
      "editorLineNumber.foreground": "#8aa1af",
      "editorLineNumber.activeForeground": "#386078"
    },
    rules: []
  });
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    target: monaco.languages.typescript.ScriptTarget.ES2020
  });
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    elfuiTypeDefinitions,
    "file:///playground/node_modules/@elfui/core/index.d.ts"
  );
  const shared = decodeState();
  const fallbackProject = initialProject();
  files.value = shared?.files?.length
    ? shared.files
    : shared?.source
      ? [initialFile(shared.source)]
      : fallbackProject.files;
  syncProjectModels();
  activeFileId.value = files.value.some((file) => file.id === shared?.activeFileId)
    ? shared!.activeFileId!
    : shared?.source
      ? files.value[0].id
      : fallbackProject.activeFileId;
  entryFileId.value = files.value.some((file) => file.id === shared?.entryFileId)
    ? shared!.entryFileId!
    : shared?.source
      ? activeFileId.value
      : fallbackProject.entryFileId;
  const restoredFile = files.value.find((file) => file.id === activeFileId.value) ?? files.value[0];
  activePreset.value = !shared
    ? "application"
    : files.value.length === 1
      ? presets.find((preset) => preset.source === restoredFile.source)?.id
      : undefined;
  const restoredModel = projectModel(restoredFile);
  editor = monaco.editor.create(editorRoot.value ?? document.body, {
    automaticLayout: true,
    fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
    fontSize: 14,
    lineHeight: 24,
    minimap: { enabled: false },
    padding: { top: 18, bottom: 18 },
    scrollBeyondLastLine: false,
    theme: editorTheme(),
    model: restoredModel
  });
  editor.onDidChangeModelContent(() => {
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
  editorModels.forEach((model) => model.dispose());
  editorModels.clear();
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
.folder-row { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 30px; border: 0; color: #6f8da3; background: transparent; text-align: left; font: 750 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .06em; cursor: pointer; }
.folder-row:hover { color: #b7d6e5; background: #0b1d2d; }
.folder-row span { width: 8px; color: #4dcbbe; font-size: 15px; }
.file-row { display: flex; flex: 1; align-items: center; gap: 8px; width: 100%; min-width: 0; min-height: 35px; padding: 0 14px; border: 0; border-left: 2px solid transparent; color: #9fb8ca; background: transparent; text-align: left; font: 650 12px/1 "JetBrains Mono", ui-monospace, monospace; }
.file-row.active { border-left-color: #45d8cf; color: #effaff; background: #0e2233; }
.file-mark { color: #49d9ca; font-size: 9px; font-weight: 900; }
.rename-file { flex: 1; min-width: 0; margin: 4px 6px; padding: 0 7px; border: 1px solid #45d8cf; border-radius: 3px; outline: 0; color: #effaff; background: #0e2233; font: 650 12px/1 "JetBrains Mono", ui-monospace, monospace; }
.rename-file-button { border: 0; padding: 0 6px; color: #5c7b91; background: transparent; font: 700 9px/1 Inter, ui-sans-serif, system-ui, sans-serif; cursor: pointer; opacity: .55; text-transform: uppercase; }
.file-entry:hover .rename-file-button { opacity: 1; color: #8ec7e0; }
.delete-file { width: 31px; border: 0; color: #5c7b91; background: transparent; font-size: 16px; cursor: pointer; }
.delete-file:hover { color: #ff9daa; background: #3a172333; }
.file-action-error { margin: 8px 14px 0; color: #ff9daa; font-size: 11px; line-height: 1.45; }
.preset-section { padding: 24px 12px; }
.preset-section p { margin: 0 0 10px; color: #547187; font: 750 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .12em; }
.preset-button { display: block; width: 100%; margin-bottom: 5px; padding: 9px 10px; border: 1px solid transparent; border-radius: 4px; color: #91aabd; background: transparent; text-align: left; font: 650 12px/1 Inter, ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
.preset-button:hover, .preset-button.active { border-color: #24455c; color: #eaf9ff; background: #0d2031; }
.file-panel-note { margin: auto 14px 16px; color: #59758a; font-size: 11px; line-height: 1.55; }
.editor-area { display: grid; grid-template-rows: 43px minmax(0, 1fr); }
.tabbar { justify-content: space-between; padding-left: 18px; }
.editor-actions { display: flex; align-items: center; gap: 10px; }
.entry-select { display: flex; align-items: center; gap: 7px; color: #6f8ca1; font: 750 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.entry-select select { max-width: 150px; min-height: 26px; padding: 0 23px 0 8px; border: 1px solid #254158; border-radius: 4px; outline: 0; color: #b8d4e4; background: #0a1a2b; font: 650 11px/1 "JetBrains Mono", ui-monospace, monospace; }
.entry-select select:focus { border-color: #45d8cf; }
.tab { color: #c0d7e6; font: 650 12px/1 "JetBrains Mono", ui-monospace, monospace; }
.tab i { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 2px; background: #49d9ca; }
.compile-state { padding: 5px 8px; border-radius: 999px; font: 750 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .04em; }
.compile-state.compiling { color: #f3c66a; background: #654b1e55; }
.compile-state.ready { color: #54e7ce; background: #12645c44; }
.compile-state.error { color: #ff9daa; background: #6f263544; }
.editor-root { min-height: 0; }
.preview-area { display: grid; grid-template-rows: 43px minmax(0, 1fr); border-right: 0; background: #091726; }
.preview-toolbar { justify-content: space-between; color: #a2bccd; letter-spacing: 0; }
.output-tabs { display: flex; align-items: stretch; align-self: stretch; margin-left: -14px; }
.output-tabs button { padding: 0 14px; border: 0; border-right: 1px solid #193044; color: #7896aa; background: transparent; font: 700 11px/1 Inter, ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
.output-tabs button.active { color: #e8f8ff; background: #0d2031; box-shadow: inset 0 -2px #45d8cf; }
.output-tabs .live-dot { margin-right: 6px; }
.preview-toolbar > span { color: #648299; font: 600 10px/1 "JetBrains Mono", ui-monospace, monospace; }
.live-dot { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 999px; background: #49d9ca; box-shadow: 0 0 12px #49d9ca; }
.preview-frame { width: 100%; height: 100%; border: 0; background: #08111f; }
.compiled-output { min-width: 0; margin: 0; padding: 18px 20px; overflow: auto; color: #c6d9e5; background: #07111f; font: 13px/1.65 "JetBrains Mono", ui-monospace, monospace; tab-size: 2; white-space: pre; }
.preview-unavailable { display: grid; place-items: center; padding: 30px; color: #ffafba; text-align: center; font-size: 13px; line-height: 1.6; }
.diagnostics { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px; min-height: 132px; padding: 23px 26px; border-top: 1px solid #193044; background: #081522; }
.diagnostics-heading p { margin: 0 0 9px; color: #49d9ca; font: 800 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .13em; }
.diagnostics-heading h1 { margin: 0; color: #e8f7ff; font-size: 20px; }
.diagnostics ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.diagnostics li { display: grid; grid-template-columns: max-content max-content minmax(0, 1fr); gap: 10px; align-items: start; padding: 9px 11px; border: 1px solid #572535; border-radius: 5px; color: #ffb1bb; background: #3a172333; font-size: 12px; cursor: pointer; }
.diagnostics li:hover { border-color: #a95064; background: #51203144; }
.diagnostics li b, .diagnostics li span { font: 700 11px/1.5 "JetBrains Mono", ui-monospace, monospace; }
.diagnostics li p, .diagnostics-empty { margin: 0; color: #91aabd; line-height: 1.55; }
.playground-shell.light { color: #18334a; background: #f5f9fc; }
.light .topbar { border-color: #cbdbe5; background: rgba(255, 255, 255, .94); }
.light .brand { color: #19334b; }
.light .quiet-button { border-color: #b8cedc; color: #3f6178; background: #f5f9fc; }
.light .quiet-button:hover { border-color: #5790aa; color: #173b53; }
.light .run-button { color: #052125; background: #3fcfc6; }
.light .file-panel { background: #f3f8fb; }
.light .editor-area { background: #f8fbfd; }
.light .preview-area { background: #fff; }
.light .file-panel, .light .editor-area, .light .preview-area { border-color: #cbdbe5; }
.light .panel-heading, .light .tabbar, .light .preview-toolbar { border-color: #cbdbe5; color: #577487; }
.light .folder-row { color: #587286; }
.light .folder-row:hover { color: #254d66; background: #e5f0f5; }
.light .file-row { color: #456177; }
.light .file-row.active { border-left-color: #189e9a; color: #173b53; background: #dff0f5; }
.light .rename-file { color: #173b53; background: #fff; }
.light .rename-file-button, .light .delete-file { color: #688398; }
.light .file-action-error { color: #b4233b; }
.light .preset-section p, .light .file-panel-note { color: #658096; }
.light .preset-button { color: #456177; }
.light .preset-button:hover, .light .preset-button.active { border-color: #b8d1df; color: #183b53; background: #e5f0f5; }
.light .entry-select { color: #547084; }
.light .entry-select select { border-color: #b8cedc; color: #34566e; background: #fff; }
.light .tab { color: #34566e; }
.light .preview-toolbar > span { color: #648096; }
.light .output-tabs button { border-color: #cbdbe5; color: #547084; }
.light .output-tabs button.active { color: #173b53; background: #e5f0f5; }
.light .preview-frame { background: #f8fbfd; }
.light .compiled-output { color: #25465e; background: #f8fbfd; }
.light .diagnostics { border-color: #cbdbe5; background: #f3f8fb; }
.light .diagnostics-heading h1 { color: #173b53; }
.light .diagnostics li { border-color: #ebacb7; color: #9d1830; background: #fff1f3; }
.light .diagnostics li:hover { border-color: #d46c7e; background: #ffe7eb; }
.light .diagnostics li p, .light .diagnostics-empty { color: #526f83; }
@media (max-width: 980px) { .workspace { grid-template-columns: 190px minmax(0, 1fr); } .preview-area { grid-column: 2; min-height: 420px; border-top: 1px solid #193044; } .diagnostics { grid-template-columns: 1fr; gap: 16px; } }
@media (max-width: 680px) { .topbar { padding: 0 14px; } .brand span, .docs-link { display: none; } .workspace { display: block; } .file-panel { min-height: 150px; border-bottom: 1px solid #193044; } .file-panel-note { display: none; } .editor-area, .preview-area { min-height: 430px; border-bottom: 1px solid #193044; } .diagnostics { padding: 20px 16px; } .diagnostics li { grid-template-columns: 1fr; gap: 4px; } }
</style>
