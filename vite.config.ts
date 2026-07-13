import { defineConfig } from "vite";
import { elfuiMacroPlugin } from "@elfui/compiler/vite";

export default defineConfig({
  plugins: [elfuiMacroPlugin({ macroImport: "@elfui/core", runtimeImport: "@elfui/core" })]
});
