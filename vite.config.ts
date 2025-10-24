import { defineConfig, mergeConfig } from "vite";
import config from "@vuebro/configs/vite";

export default mergeConfig(
  config,
  defineConfig({
    build: {
      lib: {
        entry: "src/vue.worker.ts",
        fileName: "vue.worker",
        formats: ["es"],
      },
      rollupOptions: {
        external: ["monaco-editor-core/esm/vs/editor/editor.worker"],
      },
      emptyOutDir: false,
    },
  }),
);
