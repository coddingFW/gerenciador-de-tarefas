import { defineConfig } from "vitest/config";

// Testes unitários da infraestrutura web (SyncEngine, adapters). Roda em Node com
// IndexedDB falso (fake-indexeddb) — sem navegador, sem Supabase real.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
