# Contribuindo

## Workflow de branches
- `feature/*` e `bugfix/*` partem de `develop`.
- `hotfix/*` parte de `main`.
- `develop` integra; `main` é produção (protegida).

## Commits
Seguimos [Conventional Commits](https://www.conventionalcommits.org/), validados por commitlint:

```
feat(goals): add weekly target
fix(sync): avoid duplicate execution logs on reconnect
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`.

## Pull Requests
- CI verde (lint, typecheck, testes, build) + 1 review.
- A cobertura do domínio (`@habit/core`) **não pode** cair de 90%.
- Toda mudança de regra de negócio vai em `@habit/core` **com teste**.

## Arquitetura
Clean Architecture. A regra de dependência aponta para dentro:
`apps/web` (UI/infra) → `@habit/core` (domínio puro). O domínio não conhece
Supabase, Preact ou IndexedDB. Ver [docs/architecture.md](docs/architecture.md).
