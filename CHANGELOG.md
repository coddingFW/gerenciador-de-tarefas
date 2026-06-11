# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/) e o projeto adota
[Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Scaffold do monorepo (npm workspaces).
- `@habit/core`: domínio puro — entidades, `StreakCalculator`, `ProductivityScore`,
  ports e use-cases `CreateGoal`/`CompleteTask`, com testes unitários.
- `supabase/`: schema inicial, RLS (owner-only + execution_logs append-only +
  proteção de role/plan), outbox de domain events, views de métricas
  (DAU/WAU/MAU/retenção), feature flags com rollout determinístico, e teste
  pgTAP de isolamento entre usuários.
- `@habit/core`: use-case `LogExecution` (registro direto de hábito).
- `apps/web`: SPA Preact + Vite + Tailwind (mobile-first), arquitetura
  local-first com Dexie/IndexedDB, `SyncEngine` idempotente, autenticação
  Google (com modo demo offline), e telas **Hoje** e **Painel** consumindo o
  domínio `@habit/core`.
- `supabase/`: derivação autoritativa server-side de métricas — funções SQL
  `recompute_streak` (trigger por log, port fiel de `StreakCalculator`),
  `productivity_score`/`compute_daily_score` (port de `ProductivityScore`) e
  `refresh_metrics_views`, com teste pgTAP comparando streak SQL × domínio.
- `supabase/functions/recompute-metrics`: Edge Function (Deno) que orquestra os
  jobs de agregação (backfill de streaks, score diário, refresh de views),
  protegida por `service_role` e pensada para execução agendada.
- `supabase/`: produção do Transactional Outbox via triggers (`GoalCreated`,
  `ExecutionLogged`, `TaskCompleted`) na mesma transação da mutação, com teste
  pgTAP, e Edge Function `event-dispatcher` (Deno) que drena `domain_events` e
  recalcula o score diário do usuário/dia afetado (entrega at-least-once).
