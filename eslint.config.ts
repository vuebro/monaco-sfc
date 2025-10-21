import shared from "@vuebro/configs/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  shared,
  { ignores: ["src/language-configs.ts"] },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.ts", "vite.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
