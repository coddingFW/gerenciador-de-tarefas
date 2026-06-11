import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

/**
 * Flat config (ESLint 9). Regras `recommended` de JS + TypeScript, sem o modo
 * type-checked (mais rápido e sem exigir project service). Prettier desliga
 * regras de formatação. As Edge Functions (Deno, imports `jsr:`) e os artefatos
 * de build/relatório ficam fora.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dev-dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "supabase/functions/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Permite o padrão de "strip" por rest e prefixo `_` para descartes.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      // Sem `console` solto no app; pontos de telemetria usam disable explícito.
      "no-console": "error",
    },
  },
  // Specs E2E rodam no Node (Playwright); libera os globals de Node lá.
  {
    files: ["apps/web/e2e/**/*.ts", "**/*.config.*", "**/vitest.setup.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
