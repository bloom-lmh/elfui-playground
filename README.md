# ElfUI Playground

The standalone editor for ElfUI macro components.

## Workspace

The Playground keeps a shareable browser-only project state. Add files from the
project panel, switch between them, and copy the resulting URL to share the
entire workspace. Every file is compiled in a Worker; the selected file is run
inside the isolated preview.

File names may include relative folders such as `components/Button.ts`. The
project panel renders those paths as a collapsible tree and normalizes repeated
path separators when a file is renamed. Click **+** to immediately enter the
path and name of a new TypeScript file.

Use **Export** to save the entire workspace as `elfui-playground.json`, and
**Import** to restore it later. Imported projects are validated before their
Monaco models and preview are replaced.

By default, **Auto save** keeps the project state in the shareable URL as you
edit. Turn it off when working with a large or temporary draft; **Copy link**
still produces an up-to-date URL on demand. The preference is kept locally in
the browser.

The default **Application** starter mirrors a real ElfUI project: `App.ts`
exports a macro component and `main.ts` imports it and calls
`createApp(App).mount("#app")`. Ordinary TypeScript entry modules are executed
without being treated as macro components.

The **Entry** selector is independent from the file being edited. Use it to
choose the module that runs in the preview; the choice is retained in shared
links and exported workspace files.

Use **Format** to run Monaco's TypeScript document formatter on the active
file. Normal edit/compile behavior resumes immediately after formatting.

The browser preview supports the stable `@elfui/core` application API and the
standalone `@elfui/reactivity` primitives. Both are available to Monaco and to
the isolated runtime without a bundler configuration.

Files run as separate browser ESM modules. Relative imports between project
files resolve automatically, for example `import { Badge } from "./Badge"`
will resolve `Badge.ts`. Monaco keeps project files as virtual TypeScript
models, so navigation and diagnostics can follow local imports as the
workspace changes. Syntactic and semantic TypeScript diagnostics also appear
in the Playground diagnostics panel with a file and source position.

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The editor runs on `localhost`; its sandbox uses
`127.0.0.1` on the same port. This keeps user-authored code on a separate
origin during local development.

## Production

Deploy the same static app to two origins. The editor lives at `play.elfui.dev`
and the `/preview` route lives at a separate `preview.elfui.dev` origin. Set
`VITE_PLAYGROUND_PREVIEW_ORIGIN` to the preview origin before building.

The application intentionally refuses to execute user code when both origins
are the same.
