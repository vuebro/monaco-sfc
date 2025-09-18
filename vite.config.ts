import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/vue.worker.ts"),
      fileName: "vue.worker",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["monaco-editor-core/esm/vs/editor/editor.worker"],
    },
  },
});
