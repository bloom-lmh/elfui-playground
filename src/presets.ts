import type { PlaygroundFile } from "./protocol";

export interface PlaygroundPreset {
  id: "counter" | "toggle" | "application";
  project?: {
    activeFileId: string;
    files: PlaygroundFile[];
  };
  source: string;
  title: string;
}

const applicationFiles: PlaygroundFile[] = [
  {
    id: "app",
    name: "App.ts",
    source: `import { defineHtml, html, useRef } from "@elfui/core";

const count = useRef(0);
const increment = () => count.set(count.peek() + 1);

export const App = defineHtml(html\`
  <main class="app">
    <h1>ElfUI Playground</h1>
    <button type="button" @click=\${increment}>Count: \${count}</button>
  </main>
\`);`
  },
  {
    id: "main",
    name: "main.ts",
    source: `import { createApp } from "@elfui/core";
import { App } from "./App";

createApp(App).mount("#app");`
  }
];

export const playgroundPresets: PlaygroundPreset[] = [
  {
    id: "application",
    title: "Application",
    source: applicationFiles[0].source,
    project: {
      activeFileId: "main",
      files: applicationFiles
    }
  },
  {
    id: "counter",
    title: "Counter",
    source: `import { defineHtml, html, useRef } from "@elfui/core";

const count = useRef(0);
const increment = () => count.set(count.peek() + 1);

export const Counter = defineHtml(html\`
  <section class="counter">
    <p>Count: \${count}</p>
    <button type="button" @click=\${increment}>Increment</button>
  </section>
\`);`
  },
  {
    id: "toggle",
    title: "Toggle",
    source: `import { defineHtml, html, useComputed, useRef } from "@elfui/core";

const enabled = useRef(true);
const label = useComputed(() => enabled.value ? "Enabled" : "Disabled");
const toggle = () => enabled.set(!enabled.peek());

export const Toggle = defineHtml(html\`
  <section class="toggle">
    <p>Feature: \${label}</p>
    <button type="button" @click=\${toggle}>Toggle</button>
  </section>
\`);`
  }
];
