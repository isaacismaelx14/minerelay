// @ts-check
import { defineConfig } from "eslint/config";
import globals from "globals";
import tailwind from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["dist/**", "src-tauri/**", "scripts/**", "vite.config.ts"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    settings: {
      tailwindcss: {
        config: {},
        cssFiles: ["src/**/*.css", "../../packages/ui/src/**/*.css"],
      },
    },
  },
  ...tailwind.configs["flat/recommended"],
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "tailwindcss/classnames-order": "warn",
      "tailwindcss/enforces-shorthand": "warn",
      "tailwindcss/no-custom-classname": "off",
      "tailwindcss/no-contradicting-classname": "warn",
    },
  },
]);
