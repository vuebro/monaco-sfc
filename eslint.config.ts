import type { ConfigWithExtendsArray } from "@eslint/config-helpers";

import eslint from "@eslint/js";
import gitignore from "eslint-config-flat-gitignore";
import { flatConfigs } from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig } from "eslint/config";
import { configs } from "typescript-eslint";

/* -------------------------------------------------------------------------- */
/*                        Настройка eslint для проекта                        */
/* -------------------------------------------------------------------------- */

export default defineConfig(
  gitignore(),
  { ignores: ["src/language-configs.ts"] },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.ts", "vite.config.ts"],
        },
      },
    },
  },
  eslint.configs.recommended,
  flatConfigs.recommended as ConfigWithExtendsArray,
  flatConfigs.typescript as ConfigWithExtendsArray,
  configs.strictTypeChecked,
  configs.stylisticTypeChecked,
  perfectionist.configs["recommended-natural"],
  eslintPluginPrettierRecommended,
);
