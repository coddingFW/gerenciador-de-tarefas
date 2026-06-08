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
