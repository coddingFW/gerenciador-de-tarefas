# ADR-0004 — PWA com `injectManifest` (Service Worker custom) vs `generateSW`

- **Status:** Aceito
- **Data:** 2026-06-16
- **Fase:** 2 (Lembretes)

## Contexto
O PWA usava `vite-plugin-pwa` em modo `generateSW` (Workbox gera o SW
automaticamente: precache do app-shell + navigateFallback). A Fase 2 precisa de
handlers de `push` e `notificationclick` no Service Worker.

## Problema
Adicionar lógica custom ao SW sem perder o precache offline já existente.

## Alternativas
1. **`injectManifest`** — SW custom (`src/sw.ts`) onde nós escrevemos os handlers
   e ainda chamamos `precacheAndRoute(self.__WB_MANIFEST)` para manter o precache.
2. **Continuar em `generateSW`** — não permite handlers custom de push de forma
   limpa (apenas via importScripts/hacks).

## Decisão
Adotar **(1)**. `vite.config.ts`: `strategies: 'injectManifest'`, `srcDir: 'src'`,
`filename: 'sw.ts'`. O `src/sw.ts` mantém `precacheAndRoute(self.__WB_MANIFEST)` +
`NavigationRoute` (fallback SPA, equivalente ao `navigateFallback` anterior) e
adiciona `push`/`notificationclick`. O `sw.ts` é excluído do `tsc` do app (usa
libs de WebWorker; é compilado pelo próprio vite-plugin-pwa).

## Consequências
- ✅ Mantém offline/precache; ganha push.
- ✅ Bundle do cliente inalterado (web-push é só server-side).
- ⚠️ O SW agora é código nosso — exige cuidado para não quebrar o precache;
  validar offline após mudanças. Tipagem do SW fica fora do typecheck principal.
