# Habit Tracker

SPA mobile-first de **hábitos, tarefas e métricas de produtividade**. Offline-first.

## Stack
- **Frontend:** Preact + Vite + TailwindCSS (SPA, mobile-first)
- **Backend/BaaS:** Supabase (Postgres + Auth + RLS + Edge Functions)
- **Auth:** Login com Google
- **Monorepo:** npm workspaces

## Arquitetura
Clean Architecture em camadas:

```
@habit/core   → domínio puro (entidades, streak, score, ports, use-cases) — sem infra
apps/web      → UI (Preact) + infraestrutura (Supabase, IndexedDB, sync)
supabase/     → schema SQL, RLS e Edge Functions
```

A regra de dependência aponta para dentro: a UI conhece o domínio; o domínio não
conhece ninguém. Detalhes em [docs/architecture.md](docs/architecture.md).

## Rodando localmente

```bash
npm install
cp .env.example .env        # preencha as chaves
npm run test:core           # roda os testes do domínio
npm run dev                 # sobe o app (quando apps/web existir)
```

## Scripts
- `npm run test:core` — testes do domínio (alvo ≥ 90% de cobertura)
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript em modo project references
- `npm run build` — build de produção

## Status
🚧 MVP em construção. Veja [CHANGELOG.md](CHANGELOG.md).

## Licença
[MIT](LICENSE)
