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

scope.onmessage = ({ data }: MessageEvent<CompileRequest>) => {
  if (data.type !== "compile") return;

  const diagnostics: PlaygroundDiagnostic[] = [];
  const files: CompiledPlaygroundFile[] = [];
  const components: PlaygroundComponent[] = [];

  for (const [index, file] of data.files.entries()) {
    try {
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

      const transpiled = ts.transpileModule(compiled.code, {
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
      components.push(...compiled.components.map(({ exportName, name }) => ({ exportName, fileId: file.id, name })));
    } catch (error) {
      diagnostics.push({
        code: "ELF_PLAYGROUND_COMPILE",
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
