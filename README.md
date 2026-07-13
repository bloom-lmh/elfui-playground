# ElfUI Playground

The standalone editor for ElfUI macro components.

## Workspace

The Playground keeps a shareable browser-only project state. Add files from the
project panel, switch between them, and copy the resulting URL to share the
entire workspace. Every file is compiled in a Worker; the selected file is run
inside the isolated preview.

Files currently compile as independent macro modules. Relative imports and
cross-file language intelligence are planned for the next workspace iteration.

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
