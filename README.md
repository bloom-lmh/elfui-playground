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

Click **Open** in Explorer to replace the workspace from a local folder, or
drop a folder/files directly onto the Explorer. Relative paths are preserved,
so imports such as `../components/Button` keep working exactly as they do in a
VS Code project. Local folder import accepts up to 64 TypeScript files, with a
500 KB limit per file.

Use **Export** to save the entire workspace as `elfui-playground.json`, and
**Import** to restore it later. Imported projects are validated before their
Monaco models and preview are replaced.

Use **Download** to generate `elfui-playground-project.zip`: it contains every
TypeScript file, a Vite setup with the ElfUI macro plugin, the selected entry
module, and an `elfui-playground.json` snapshot for later re-import.
When the selected entry exports a component instead of calling `createApp`, the
download also includes a small generated bootstrap module so the project runs
immediately.

Use **Imports** to configure a shareable Import Map for external HTTP(S) ESM
packages. Exact names and prefix names ending in `/` are supported. The map is
applied in the isolated preview and included in exports and downloaded projects.

By default, **Auto save** keeps the project state in the shareable URL as you
edit. Turn it off when working with a large or temporary draft; **Copy link**
still produces an up-to-date URL on demand. The preference is kept locally in
the browser.

Use **Light theme** or **Dark theme** to switch the editor chrome and preview
canvas without restarting the running preview. The choice is kept locally; a
component's own styles remain under the component author's control.

The default **Application** starter mirrors a real ElfUI project: `App.ts`
exports a macro component and `main.ts` imports it and calls
`createApp(App).mount("#app")`. Ordinary TypeScript entry modules are executed
without being treated as macro components.

The **Entry** selector is independent from the file being edited. Use it to
choose the module that runs in the preview; the choice is retained in shared
links and exported workspace files.

Use **Format** to run Monaco's TypeScript document formatter on the active
file. Normal edit/compile behavior resumes immediately after formatting.

Use **Ctrl+Enter** (or **Cmd+Enter** on macOS) to run the project from the
keyboard.

**Run** updates the already-loaded preview sandbox instead of recreating its
iframe. A successful run therefore keeps the canvas stable rather than showing
a white transition between renders.

The **Console** output tab captures `console.log`, `console.info`,
`console.warn`, `console.error`, and unhandled preview rejections. Entries are
scoped to the latest run, so stale iframe output cannot obscure current errors.

Use the **Viewport** selector above Preview to test responsive layouts at the
available panel width, 768px tablet, or 390px mobile width. Switching a viewport
does not restart the running project.

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

## Deployment

The repository is ready for a Vercel static-site project. Import
`bloom-lmh/elfui-playground`, use the committed defaults, and publish it at a
stable URL (for example, `elfui-playground.vercel.app`). That published URL is
the target for the official documentation's Playground entry point.

Open `http://localhost:5173`. The editor runs on `localhost`; its sandbox uses
`127.0.0.1` on the same port. This keeps user-authored code on a separate
origin during local development.

## Production

Deploy the same static app to two Vercel projects (or two other static-site
origins). The editor lives at `play.elfui.dev` and the `/preview` route lives
at a separate `preview.elfui.dev` origin. Configure the preview project first,
then set `VITE_PLAYGROUND_PREVIEW_ORIGIN=https://preview.elfui.dev` in the
editor project's Production environment variables and redeploy the editor.

The application intentionally refuses to execute user code when both origins
are the same.
