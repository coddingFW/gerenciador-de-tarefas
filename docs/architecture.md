# Arquitetura — Habit Tracker

Documento vivo. Resume as decisões; o racional completo (trade-offs) está no
histórico de design do produto.

## Decisões-chave
- **BaaS: Supabase** — Postgres + RLS + SQL vencem pelo peso analítico do produto
  (DAU/WAU/MAU, retenção, cohorts) e pelo isolamento de dados por `user_id`.
- **Frontend: Preact + Vite + Tailwind** — bundle mínimo (~3KB) para atender
  mobile-first e < 2s; `preact/compat` mantém o ecossistema React.
- **Clean Architecture** — `@habit/core` é domínio puro (sem infra). A UI e a
  infraestrutura dependem do domínio via Ports/Adapters, nunca o contrário.
- **Event-Driven** — toda mutação emite um Domain Event (outbox `domain_events`)
  consumido por métricas, auditoria, analytics e IA.
- **Offline-first** — IndexedDB (Dexie) + fila outbox; `ExecutionLog` é
  append-only e idempotente por `clientEventId`, eliminando a maior parte dos
  conflitos de sincronização.

## Camadas
```
@habit/core   domínio puro: entidades, StreakCalculator, ProductivityScore,
              ports, use-cases (CreateGoal, CompleteTask)   ← sem dependências de infra
apps/web      Preact (UI) + adapters (Supabase, IndexedDB, sync, Sentry)
supabase/     schema SQL + RLS + Edge Functions
```

## Regras invioláveis
1. **Isolamento:** RLS por `user_id` em todas as tabelas de usuário. O banco é a
   última linha de defesa — um bug de front não vaza dados.
2. **Métricas confiáveis:** streak/score são derivados no servidor a partir dos
   logs; o cliente nunca os escreve. Testes comparam domínio × SQL.
3. **Auditoria:** toda ação administrativa grava `AuditLog`; `metrics`/`streaks`
   não têm policy de UPDATE para cliente algum.

## Estado atual
- [x] Scaffold do monorepo (npm workspaces)
- [x] `@habit/core` com testes (25 testes, 100% linhas / 96% branches)
- [ ] `supabase/` — migrations + RLS
- [ ] `apps/web` — UI + infra + sync engine
- [ ] E2E (Playwright)

## Nota sobre o gerenciador de pacotes
O design previa `pnpm`; o ambiente local não permitiu ativar o corepack, então
adotamos **npm workspaces** (equivalente funcional). Dependências locais usam
`"*"` em vez de `"workspace:*"`.
