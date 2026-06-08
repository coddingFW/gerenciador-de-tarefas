import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/**/*.d.ts"],
      thresholds: {
        // O domínio é puro → mantemos a barra alta desde o dia 1 (Fase 1 §11).
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
