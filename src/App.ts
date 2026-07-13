import { defineHtml, html, useRef } from "@elfui/core";

const count = useRef(0);

export const App = defineHtml(html`
  <main class="app-shell">
    <p class="eyebrow">ELFUI · STACKBLITZ STARTER</p>
    <h1>Build with ElfUI</h1>
    <p class="intro">Edit <code>src/App.ts</code>, save, and the Vite preview updates automatically.</p>
    <button type="button" @click=${() => count.set(count.peek() + 1)}>
      Count: ${count}
    </button>
  </main>
`);
