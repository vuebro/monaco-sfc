import shared from "@vuebro/configs/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(shared, {
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: [
          "eslint.config.ts",
          "vite.config.ts",
          "prettierrc.config.ts",
        ],
      },
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
