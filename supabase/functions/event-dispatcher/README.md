# event-dispatcher

Consome o **Transactional Outbox** (`domain_events`) e encaminha os eventos aos
consumidores. É o motor event-driven do servidor (Fase 1 §6).

## Produção dos eventos
Os eventos são gravados **na mesma transação** da mutação, por triggers
(migration [`0007_domain_events_triggers.sql`](../../migrations/0007_domain_events_triggers.sql)):

| Mutação                         | Evento           |
| ------------------------------- | ---------------- |
| `insert` em `goals`             | `GoalCreated`    |
| `insert` em `execution_logs`    | `ExecutionLogged`|
| `update` de `tasks` → `done`    | `TaskCompleted`  |

Isso espelha o catálogo de `@habit/core` (`domain/events`) — o cliente não
precisa enviar eventos; o banco é a fonte da verdade do outbox.

## Consumo
Para cada evento pendente (`processed_at is null`), o dispatcher recalcula o
**score diário** do usuário/dia afetado (`compute_daily_score`), coalescendo um
único recompute por `(usuário, dia)`. A streak já é derivada pelo seu próprio
trigger. Entrega **at-least-once**: lê → executa (idempotente) → marca
processado; se um efeito falha, o lote fica pendente para a próxima rodada.

## Invocação (server-only)
```bash
curl -X POST "$SUPABASE_URL/functions/v1/event-dispatcher" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d '{ "limit": 200 }'
```

## Deploy & agendamento
```bash
supabase functions deploy event-dispatcher
```
Agende em alta frequência (ex.: a cada 1–5 min via pg_cron + `net.http_post`)
para drenar a fila continuamente. Ver o exemplo de cron em
[`../recompute-metrics/README.md`](../recompute-metrics/README.md).
