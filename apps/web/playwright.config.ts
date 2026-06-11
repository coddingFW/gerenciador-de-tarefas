import { defineConfig, devices } from "@playwright/test";

/**
 * E2E (Fase 1 §11). Roda contra o app em modo demo offline (sem Supabase): o
 * IndexedDB é a fonte da verdade e cada teste tem contexto isolado. Sobe o
 * próprio dev server; em CI não reaproveita um já existente.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
