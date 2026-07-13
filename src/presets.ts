export interface PlaygroundPreset {
  id: "counter" | "toggle";
  source: string;
  title: string;
}

export const playgroundPresets: PlaygroundPreset[] = [
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
