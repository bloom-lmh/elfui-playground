export interface PlaygroundDiagnostic {
  code: string;
  column?: number;
  filename?: string;
  line?: number;
  message: string;
  severity: "error" | "warning";
}

export interface PlaygroundComponent {
  exportName: string;
  fileId: string;
  name: string;
}

export interface PlaygroundFile {
  id: string;
  name: string;
  source: string;
}

export interface CompiledPlaygroundFile {
  code: string;
  id: string;
}

export interface CompileRequest {
  activeFileId: string;
  files: PlaygroundFile[];
  id: number;
  type: "compile";
}

export interface CompileResponse {
  components?: PlaygroundComponent[];
  diagnostics: PlaygroundDiagnostic[];
  files?: CompiledPlaygroundFile[];
  id: number;
  type: "compiled";
}

export interface PreviewRunMessage {
  activeFileId: string;
  components: PlaygroundComponent[];
  files: CompiledPlaygroundFile[];
  id: number;
  type: "elfui-playground:run";
}

export interface PreviewStatusMessage {
  id: number;
  message?: string;
  type: "elfui-playground:error" | "elfui-playground:host-ready" | "elfui-playground:ready";
}
