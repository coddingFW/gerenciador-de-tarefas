import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// preact/compat permite usar libs do ecossistema React (ex.: dexie-react-hooks)
// mantendo o bundle do Preact (~3KB) — atende mobile-first e < 2s (Fase 1 §2).
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
    },
  },
  build: {
    target: "es2020",
  },
});
