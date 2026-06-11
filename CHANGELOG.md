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
- `@habit/core`: use-cases `EditGoal` e `ArchiveGoal` (excluir = arquivar/soft
  delete, com restauração), com testes; eventos `GoalUpdated`/`GoalArchived`.
- `apps/web`: edição inline e arquivamento de hábitos na tela **Hoje**
  (componente `GoalRow`); trigger de outbox para updates de `goals`.
- `apps/web`: PWA instalável e offline-first de verdade — `vite-plugin-pwa`
  (Workbox) pré-cacheia o app-shell e os assets, com manifest e ícone; o
  IndexedDB segue como fonte da verdade dos dados.
- `apps/web`: testes E2E (Playwright) cobrindo o ciclo de vida do hábito
  (criar → concluir → editar → arquivar) em modo demo offline; job `e2e` no CI.
- `supabase/functions/admin-api`: Edge Function (Deno) do painel admin —
  autoriza por JWT + `role = 'admin'`, expõe as views administrativas e o
  gerenciamento de feature flags com auditoria; teste pgTAP do modelo de acesso.
- **Timezone do usuário**: captura silenciosa do fuso do navegador no
  login/primeiro carregamento, persistido no perfil (use-case `SyncUserTimezone`
  + `IProfileRepository`), eliminando a divergência servidor (UTC) × cliente nos
  cálculos de streak/score.
- **Categorias de hábitos**: `ICategoryRepository` + use-cases
  `CreateCategory`/`EditCategory`/`ReorderCategories`, store Dexie + push de
  sync, e UI completa (cor/ícone/nome, reordenar, arquivar) com agrupamento dos
  hábitos por categoria na tela Hoje.
- **Tarefas avulsas**: use-cases `CreateTask`/`ReopenTask` (desfazer reverte o
  status; o log imutável permanece) e tela dedicada (pendentes/concluídas),
  separada dos hábitos recorrentes.
- **Dashboard histórico**: serviço de domínio `HistoryAggregator` (séries 7/30
  dias a partir dos `execution_logs` locais) + gráfico de barras SVG, com estados
  loading/empty/erro/dados insuficientes.
- `apps/web`: testes E2E de categorias, tarefas e histórico do dashboard.
- **Sincronização de descida (pull) + restore**: o `SyncEngine` agora baixa o
  estado do servidor no bootstrap (primeiro acesso/novo dispositivo/limpeza de
  cache) antes de enviar os pendentes. Merge seguro (não sobrescreve registros
  locais `_sync = 0`; logs idempotentes por `(userId, clientEventId)`). Testes
  unitários do web com `vitest` + `fake-indexeddb`; job no CI.
