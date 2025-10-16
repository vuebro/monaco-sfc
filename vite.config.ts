import { defineConfig } from "vite";

/* -------------------------------------------------------------------------- */
/*                 Настройка vite для библиотеки vue.worker.ts                */
/* -------------------------------------------------------------------------- */

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/vue.worker.ts",
      fileName: "vue.worker",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["monaco-editor-core/esm/vs/editor/editor.worker"],
    },
  },
});
