import { compileMacroComponent } from "@elfui/compiler/macro-component";
import ts from "typescript";

import type {
  CompileRequest,
  CompileResponse,
  CompiledPlaygroundFile,
  PlaygroundComponent,
  PlaygroundDiagnostic
} from "./protocol";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CompileRequest>) => void) | null;
  postMessage: (message: CompileResponse) => void;
};

const toDiagnostic = (diagnostic: {
  code: string;
  column?: number;
  line?: number;
  message: string;
  severity: "error" | "warning";
}, filename: string): PlaygroundDiagnostic => ({
  code: diagnostic.code,
  ...(diagnostic.column ? { column: diagnostic.column } : {}),
  filename,
  ...(diagnostic.line ? { line: diagnostic.line } : {}),
  message: diagnostic.message,
  severity: diagnostic.severity
});

const errorLocation = (source: string, error: unknown): Pick<PlaygroundDiagnostic, "column" | "line"> => {
  const loc = (error as { loc?: { start?: { offset?: number } } } | undefined)?.loc?.start;
  if (typeof loc?.offset !== "number") return {};
  const templateStart = source.indexOf("html`");
  if (templateStart < 0) return {};
  const offset = templateStart + "html`".length + loc.offset;
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  const column = before.length - before.lastIndexOf("\n");
  return { column, line };
};

scope.onmessage = ({ data }: MessageEvent<CompileRequest>) => {
  if (data.type !== "compile") return;

  const diagnostics: PlaygroundDiagnostic[] = [];
  const files: CompiledPlaygroundFile[] = [];
  const components: PlaygroundComponent[] = [];

  for (const [index, file] of data.files.entries()) {
    try {
      const isMacroModule = /\b(?:defineHtml|html)\b/.test(file.source);
      let output = file.source;

      if (isMacroModule) {
        const compiled = compileMacroComponent(file.source, {
          filename: file.name,
          macroImport: "@elfui/core",
          tagPrefix: `elf-play-${data.id}-${index}`,
          // Browser template type checking becomes available with Language Tools.
          templateTypeCheck: false
        });
        const fileDiagnostics = compiled.diagnostics.map((diagnostic) => toDiagnostic(diagnostic, file.name));
        diagnostics.push(...fileDiagnostics);
        if (fileDiagnostics.some((diagnostic) => diagnostic.severity === "error")) continue;
        output = compiled.code;
        components.push(...compiled.components.map(({ exportName, name }) => ({ exportName, fileId: file.id, name })));
      }

      const transpiled = ts.transpileModule(output, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        reportDiagnostics: true
      });
      const transpileDiagnostics: PlaygroundDiagnostic[] = (transpiled.diagnostics ?? []).map((diagnostic) => ({
        code: `TS${diagnostic.code}`,
        filename: file.name,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        severity: "error"
      }));
      diagnostics.push(...transpileDiagnostics);
      if (transpileDiagnostics.length) continue;

      files.push({ code: transpiled.outputText, id: file.id, name: file.name });
    } catch (error) {
      diagnostics.push({
        code: "ELF_PLAYGROUND_COMPILE",
        ...errorLocation(file.source, error),
        filename: file.name,
        message: error instanceof Error ? error.message : String(error),
        severity: "error"
      });
    }
  }

  const response: CompileResponse = diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? { diagnostics, id: data.id, type: "compiled" }
    : { components, diagnostics, files, id: data.id, type: "compiled" };
  scope.postMessage(response);
};
