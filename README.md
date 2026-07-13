# ElfUI Playground

This repository is the official ElfUI starter for [StackBlitz](https://stackblitz.com/).
It is a normal Vite project: StackBlitz installs the dependencies, starts the
development server, and provides its own full file explorer, terminal, and
preview. There is no separately deployed ElfUI editor to maintain.

## Open online

Open an editable copy in StackBlitz:

```text
https://stackblitz.com/fork/github/bloom-lmh/elfui-playground?startScript=dev&title=ElfUI%20Playground
```

Use the `fork` URL for documentation links. Each visitor receives their own
workspace, so the official starter remains unchanged. In StackBlitz, drop local
files or a folder onto the Explorer to add them to the project.

## Project structure

```text
src/App.ts   # ElfUI macro component
src/main.ts  # Application entry point
```

`vite.config.ts` enables `elfuiMacroPlugin`, so regular `.ts` files can use
ElfUI's `defineHtml` and `html` macros. Add folders and modules freely; Vite
handles relative imports as it does in a local editor.

## Develop locally

```bash
pnpm install
pnpm dev
```

## Maintain the starter

The GitHub `main` branch is the source of truth. Update this repository when
the recommended ElfUI version or example should change; StackBlitz imports the
latest public GitHub revision when visitors open the link.
