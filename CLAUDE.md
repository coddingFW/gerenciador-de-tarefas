# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Habit Tracker — SPA mobile-first de hábitos, tarefas e métricas de produtividade. Offline-first. npm workspaces monorepo: `packages/core` (domínio puro) + `apps/web` (Preact) + `supabase/` (Postgres/RLS/Edge Functions).

## Commands

Run from repo root unless noted.

```
npm run dev              # vite dev server (apps/web), porta 5173
npm run build            # build core, depois web
npm run lint             # eslint . --max-warnings=0
npm run format           # prettier --write .
npm run typecheck        # tsc -b (todo o monorepo)
npm test                 # testes de todos os workspaces
npm run test:core        # vitest no @habit/core (cobertura precisa ficar >= 90%)
npm run test:e2e         # playwright (apps/web), sobe o app em modo demo offline
```

Rodar um teste único:
```
npm run test --workspace @habit/core -- ProductivityScore   # vitest, filtro por nome
npx playwright test e2e/<arquivo>.spec.ts                    # de dentro de apps/web
```

Testes de banco (pgTAP — RLS + streak SQL × domínio), requer Supabase CLI/Docker:
```
supabase start
supabase test db
```
Docker local não funciona nesta máquina de dev; migrations já foram validadas com `supabase db push` contra um projeto cloud real.

CI (`.github/workflows/ci.yml`) roda três jobs em paralelo: `quality` (lint+typecheck+test+build), `database` (pgTAP), `e2e` (Playwright). PRs exigem CI verde + 1 review.

Commits seguem Conventional Commits (validado por commitlint): `feat(scope): ...`, `fix(scope): ...`, tipos em [CONTRIBUTING.md](CONTRIBUTING.md). Branches: `feature/*`/`bugfix/*` partem de `develop`; `hotfix/*` parte de `main`; `main` é produção.

## Architecture

Clean Architecture com regra de dependência apontando para dentro: `apps/web` (UI + infra) → `@habit/core` (domínio puro, sem Preact/Supabase/IndexedDB).

```
packages/core/src/
  domain/entities/        Goal, Task, Category, Profile, ExecutionLog, Reminder (tipos puros)
  domain/services/        StreakCalculator, ProductivityScore — lógica pura, espelhada em SQL
  domain/events/          Domain Events (outbox pattern)
  application/ports/      interfaces (IGoalRepository, IClock, IEventBus, IIdGenerator, ...)
  application/use-cases/  um caso de uso por arquivo (CreateGoal, CompleteTask, LogExecution, ...)

apps/web/src/
  lib/container.ts        Composition Root — ÚNICO lugar onde Ports encontram Adapters.
                          Trocar storage/backend = mudar só este arquivo.
  infrastructure/
    persistence/          Dexie (IndexedDB) — LocalRepositories implementam os ports do core
    sync/SyncEngine       fila outbox + push para Supabase + pull no bootstrap + Realtime
                          (subscribeRealtime aplica postgres_changes ao Dexie ao vivo)
    supabase/             client do Supabase
    adapters/             SystemClock, CryptoIdGenerator, LocalEventBus
  ui/features/<nome>/     uma pasta por tela (today, tasks, calendar, dashboard, categories,
                          profile, reminders) — componentes Preact que chamam `container.<useCase>`

supabase/
  migrations/             0001..NNNN, schema + RLS + triggers + views de métricas
  functions/              Edge Functions: recompute-metrics, event-dispatcher, admin-api,
                          delete-account, send-reminders
  tests/                  pgTAP
```

Regras invioláveis (ver [docs/architecture.md](docs/architecture.md) e [CONTRIBUTING.md](CONTRIBUTING.md)):
1. **Isolamento por RLS** em todas as tabelas de usuário — o banco é a última linha de defesa.
2. **Streak/score são derivados no servidor**, nunca escritos pelo cliente. `recompute_streak` (trigger SQL) e `compute_daily_score`/`recompute-metrics` (Edge Function) são port fiel de `StreakCalculator`/`ProductivityScore`; testes pgTAP comparam SQL × domínio.
3. **Auditoria**: toda ação administrativa grava `AuditLog`; `metrics`/`streaks` não têm policy de UPDATE para o cliente.
4. Toda mudança de regra de negócio entra em `@habit/core` **com teste** (cobertura não pode cair de 90%).

Event-driven: toda mutação de domínio emite um Domain Event para uma fila outbox (`domain_events`), consumida por métricas/auditoria/analytics.

Offline-first: sem `VITE_SUPABASE_*` configurado, o app cai em usuário demo local com IndexedDB como única fonte de verdade. Com as variáveis preenchidas, ativa Google OAuth e o `SyncEngine` drena a fila outbox para o Supabase.

Datas: `IsoDate` (`YYYY-MM-DD`) sempre representa o dia no fuso do usuário (`Profile.timezone`), nunca UTC do servidor — ver `SyncUserTimezone` e o uso em `CalendarPage`/`TodayPage`.

ADRs em [docs/adr/](docs/adr/) documentam decisões específicas (pg_cron, Sentry, web push/VAPID, PWA, reminders, dark mode, avatar upload, calendário, LGPD/export de dados).

## Package manager note

O design previa `pnpm`; o ambiente local não permitiu ativar o corepack, então o projeto usa **npm workspaces**. Dependências internas usam `"*"` em vez de `"workspace:*"`.
