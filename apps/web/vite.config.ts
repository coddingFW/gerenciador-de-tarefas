import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// preact/compat permite usar libs do ecossistema React (ex.: dexie-react-hooks)
// mantendo o bundle do Preact (~3KB) — atende mobile-first e < 2s (Fase 1 §2).
export default defineConfig({
  plugins: [
    preact(),
    // PWA: app-shell offline + instalável. O Workbox pré-cacheia os assets
    // hasheados do build; o IndexedDB (Dexie) já cobre os dados offline. As
    // chamadas ao Supabase (outra origem) não são cacheadas — passam pela rede.
    VitePWA({
      // injectManifest: SW custom (src/sw.ts) com handlers de Web Push, mantendo
      // o precache do app-shell. Ver ADR-0004.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Habit Tracker",
        short_name: "Habits",
        description: "Hábitos, tarefas e métricas de produtividade. Offline-first.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#0ea5e9",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
      // Habilita o SW também em dev para validação local.
      devOptions: { enabled: true, type: "module" },
    }),
  ],
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
