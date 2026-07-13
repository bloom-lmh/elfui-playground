import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // The beta compiler imports this Node helper even when template checking is disabled.
      "node:path": fileURLToPath(new URL("./src/node-path-shim.ts", import.meta.url))
    }
  }
});
