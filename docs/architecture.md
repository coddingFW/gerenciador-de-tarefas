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
  imutável em conteúdo e idempotente por `clientEventId`, eliminando a maior
  parte dos conflitos de sincronização. Exceção (migration `0016`): o dono pode
  **apagar** os próprios logs (undo de conclusão = liga-desliga); a streak é
  recalculada no delete. Não há UPDATE — só insert/delete.

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
- [x] `supabase/` — schema, RLS, outbox, views de métricas, feature flags + teste de isolamento
- [x] `apps/web` — Preact + Tailwind, adapters local-first (Dexie), SyncEngine,
      auth (Google/demo), telas Hoje e Painel. Build: ~48KB gzip.
- [x] Métricas server-side — `recompute_streak` (trigger), `compute_daily_score`
      e `recompute-metrics` (Edge Function), com teste pgTAP streak SQL × domínio.
- [x] Outbox event-driven — triggers que emitem `domain_events` na transação +
      `event-dispatcher` (Edge Function) que drena a fila e recalcula o score.
- [x] CRUD de hábitos — use-cases `EditGoal`/`ArchiveGoal` (excluir = arquivar)
      + edição inline e arquivamento na tela Hoje (`GoalRow`).
- [x] PWA instalável e offline-first (`vite-plugin-pwa`/Workbox: app-shell em
      cache + manifest); IndexedDB como fonte da verdade dos dados.
- [x] E2E (Playwright) — ciclo de vida do hábito em modo demo, job `e2e` no CI.
- [x] Edge Functions completas — `recompute-metrics`, `event-dispatcher` e
      `admin-api` (painel admin: métricas + feature flags com auditoria).
- [x] Timezone do usuário — captura silenciosa + persistência no perfil
      (`SyncUserTimezone`/`IProfileRepository`); alinha o cálculo cliente×servidor.
- [x] Categorias — `ICategoryRepository` + use-cases + UI (cor/ícone/reordenar)
      e agrupamento de hábitos por categoria.
- [x] Tarefas avulsas — `CreateTask`/`ReopenTask` + tela própria (pendentes/concluídas).
- [x] Dashboard histórico — `HistoryAggregator` (7/30 dias) + gráfico SVG, com estados.
- [x] Sync de descida (pull) + restore — `SyncEngine.pull` baixa o estado do
      servidor no bootstrap, merge seguro; testes web (`vitest`+`fake-indexeddb`).
- [x] Sync em tempo real — `SyncEngine.subscribeRealtime` aplica `postgres_changes`
      do Supabase ao Dexie ao vivo (multi-dispositivo); migration `0009` habilita
      o Realtime; testes do handler.
- [x] Lint — ESLint 9 (flat config) + typescript-eslint; `npm run lint` no CI.
- [x] **Produção (Fase 1)** — agendamento `pg_cron`/`pg_net` (migration `0011`,
      service_role no Vault), Sentry lazy/no-op no frontend, `vercel.json` e guia
      de deploy ([deployment.md](deployment.md)). ADR-0001/0002.

### Derivação server-side (regra inviolável #2)
Streak e score são **derivados no servidor** a partir dos `execution_logs`
(append-only); o cliente nunca os escreve. A streak é recalculada na mesma
transação de cada log via trigger (`trg_execution_logs_streak`), e o job
`recompute-metrics` faz a reconciliação periódica + score diário + refresh de
views. As funções SQL são port fiel de `@habit/core` e o teste pgTAP compara o
resultado SQL contra os mesmos casos do `StreakCalculator`.

> O app roda offline-first por padrão: sem `VITE_SUPABASE_*` configurado, usa um
> usuário de demonstração local e o IndexedDB como fonte da verdade. Com as
> variáveis preenchidas, ativa Google OAuth e o SyncEngine drena a fila para o
> Supabase. Fluxo validado no navegador (criar hábito → concluir → painel).

> ✅ As migrations `0001`→`0011` foram aplicadas com sucesso contra um projeto
> Supabase real via `supabase db push` (2026-06-16), incluindo a `0011`
> (pg_cron/pg_net) — confirmando que o schema aplica limpo. Validação local de
> RLS/streak com `supabase test db` (pgTAP) ainda pendente (depende de Docker,
> indisponível no ambiente de dev).

## Nota sobre o gerenciador de pacotes
O design previa `pnpm`; o ambiente local não permitiu ativar o corepack, então
adotamos **npm workspaces** (equivalente funcional). Dependências locais usam
`"*"` em vez de `"workspace:*"`.
