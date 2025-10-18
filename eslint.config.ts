import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";
import gitignore from "eslint-config-flat-gitignore";
import { configs as deMorganConfigs } from "eslint-plugin-de-morgan";
import { configs as dependConfigs } from "eslint-plugin-depend";
import { flatConfigs as importXConfigs } from "eslint-plugin-import-x";
import jsDoc from "eslint-plugin-jsdoc";
import { configs as packageJsonConfigs } from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import prettierConfigsRecommended from "eslint-plugin-prettier/recommended";
import { configs as regexpConfigs } from "eslint-plugin-regexp";
import vue from "eslint-plugin-vue";

/* -------------------------------------------------------------------------- */
/*                        Настройка eslint для проекта                        */
/* -------------------------------------------------------------------------- */

export default defineConfigWithVueTs(
  gitignore(),
  {
    extends: [
      js.configs.recommended,
      vue.configs["flat/recommended"],
      vueTsConfigs.strictTypeChecked,
      vueTsConfigs.stylisticTypeChecked,
      perfectionist.configs["recommended-natural"],
      jsDoc.configs["flat/recommended"],
      regexpConfigs["flat/recommended"],
    ],
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.ts", "vite.config.ts"],
        },
      },
    },
  },
  deMorganConfigs.recommended,
  importXConfigs.recommended,
  importXConfigs.typescript,
  dependConfigs["flat/recommended"],
  json.configs.recommended,
  markdown.configs.recommended,
  packageJsonConfigs.recommended,
  prettierConfigsRecommended,
);
