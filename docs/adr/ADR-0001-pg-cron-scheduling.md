# ADR-0001 — Agendamento dos jobs server-side com pg_cron + pg_net (via Vault)

- **Status:** Aceito
- **Data:** 2026-06-16
- **Fase:** 1 (Produção)

## Contexto
As Edge Functions `recompute-metrics` (reconciliação diária de streak/score +
refresh de views) e `event-dispatcher` (drenar o outbox `domain_events`) já
existem e se autorizam por `service_role`. Até então não havia nada que as
invocasse periodicamente — as métricas só seriam recalculadas pelo trigger
transacional de streak, deixando score diário e views sem reconciliação.

## Problema
Como disparar essas funções de forma confiável, no servidor, sem:
1. expor a `service_role` (regra de segurança inviolável); e
2. introduzir infraestrutura adicional (scheduler externo, fila, cron host)?

## Alternativas
1. **pg_cron + pg_net, segredos no Vault** — agendamento dentro do próprio
   Postgres do Supabase; a key fica cifrada no Vault e é lida em runtime.
2. **pg_cron com `current_setting('app.service_role_key')`** — exemplo dos
   READMEs; deixa a `service_role` legível por quem acessar o setting. Rejeitado
   por violar o princípio do menor privilégio.
3. **Scheduler externo (GitHub Actions cron / plataforma)** — adiciona infra e um
   lugar a mais para guardar a key. Rejeitado por overengineering nesta fase.

## Decisão
Adotar **(1)**. A migration `0011_cron_jobs.sql` habilita `pg_cron`/`pg_net`,
cria a função `SECURITY DEFINER` `public._invoke_edge_function(fn, body)` que lê
`project_url` e `service_role_key` de `vault.decrypted_secrets`, e agenda:
- `recompute-metrics-daily` — `0 3 * * *`
- `event-dispatcher-5min` — `*/5 * * * *`

Os segredos são inseridos **fora do versionamento** via `vault.create_secret`
(documentado na migration); a key nunca entra no git nem no bundle.

## Consequências
- ✅ Zero infra nova; agendamento versionado e idempotente.
- ✅ `service_role` cifrada no Vault; `_invoke_edge_function` sem EXECUTE para
  `anon`/`authenticated`.
- ⚠️ Os jobs só funcionam após o operador popular o Vault; sem os segredos, o
  helper emite `warning` e não dispara (degradação visível, não silenciosa).
- ⚠️ A job `database` do CI precisa de `pg_cron`/`pg_net` no stack local do
  Supabase. Se a extensão não estiver disponível, mover o agendamento para um
  script operacional aplicado só em produção (fallback documentado).
