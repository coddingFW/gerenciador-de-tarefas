# recompute-metrics

Job de agregação **server-side**. Mantém os dados derivados (streak/score) e as
views analíticas como fonte da verdade no servidor — o cliente nunca os escreve
(regra inviolável #2 da [arquitetura](../../../docs/architecture.md)).

## O que faz
1. `recompute_user_streaks` — reconciliação/backfill das streaks diárias.
   (O caminho quente já é coberto pelo trigger `trg_execution_logs_streak`, que
   recalcula a streak na mesma transação de cada `execution_log`.)
2. `compute_daily_score` — grava o score de produtividade do dia em `metrics`
   (`metric_key = 'daily_score'`).
3. `refresh_metrics_views` — atualiza a matview de retenção.

A lógica de cálculo é um port fiel de `@habit/core`
(`StreakCalculator` / `ProductivityScore`), definida em SQL na migration
[`0006_metrics_recompute.sql`](../../migrations/0006_metrics_recompute.sql) e
coberta por [`streaks_recompute.test.sql`](../../tests/streaks_recompute.test.sql).

## Invocação (server-only)
Aceita **apenas** a `service_role` key no header `Authorization`:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/recompute-metrics" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d '{ "day": "2026-06-11" }'          # userId e day são opcionais
```

- Sem `userId`: processa todos os profiles.
- Sem `day`: usa a data corrente (UTC).
- Resposta `200` (tudo ok) ou `207` (alguns usuários falharam), com o detalhe por usuário.

## Deploy & agendamento
```bash
supabase functions deploy recompute-metrics
```
Agende uma execução diária (ex.: pg_cron no banco, ou o scheduler da plataforma)
apontando para a URL acima com a service_role key. Ex.: pg_cron a cada noite:

```sql
select cron.schedule('daily-metrics', '0 3 * * *', $$
  select net.http_post(
    url     := 'https://<ref>.supabase.co/functions/v1/recompute-metrics',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body    := '{}'::jsonb
  );
$$);
```
