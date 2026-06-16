# ADR-0002 — Observabilidade de erros no frontend com Sentry (lazy)

- **Status:** Aceito
- **Data:** 2026-06-16
- **Fase:** 1 (Produção)

## Contexto
`VITE_SENTRY_DSN` já estava tipado em `vite-env.d.ts` e declarado no
`.env.example`, mas nenhum `Sentry.init` existia — o app não reportava erros em
produção.

## Problema
Ligar a telemetria de erros sem:
1. quebrar o modo demo/offline (que roda sem backend); e
2. estourar o orçamento de bundle mobile-first (alvo ~48KB gzip), já que o SDK do
   Sentry é pesado (~25–30KB gzip).

## Alternativas
1. **Import estático de `@sentry/browser` no boot** — simples, mas soma o SDK ao
   bundle base de todos (inclusive demo offline). Rejeitado pelo peso.
2. **Import dinâmico, condicionado ao DSN** — o SDK vira um chunk separado,
   baixado apenas quando há DSN (produção). Bundle base intacto.
3. **Sem Sentry / logging próprio** — reinventa observabilidade. Rejeitado.

## Decisão
Adotar **(2)**. `infrastructure/observability/sentry.ts` expõe `initSentry()`:
no-op quando o DSN está vazio; caso contrário, `await import("@sentry/browser")`
e `Sentry.init` com `tracesSampleRate: 0.1` e `sendDefaultPii: false`. Chamado em
`main.tsx` antes do render.

## Consequências
- ✅ **Custo zero sem DSN (medido):** como `VITE_SENTRY_DSN` é resolvido em
  build-time, num build sem DSN o `if (!dsn) return;` torna o `import()`
  inalcançável e o Rollup **elimina o SDK por tree-shaking** — 0 ocorrências de
  `sentry` no bundle, nenhum chunk gerado. Confirmado no build de 2026-06-16.
- ✅ Com DSN no build, o SDK vira um chunk lazy separado (~25–30KB gzip),
  carregado fora do caminho crítico.
- ✅ Sem PII por padrão.
- ⚠️ Eventos de inicialização que ocorram antes do `import` resolver podem não ser
  capturados (janela curta). Aceitável para esta fase.
