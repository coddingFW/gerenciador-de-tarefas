# send-reminders

Dispara os **Web Push** dos lembretes de hábitos que estão vencendo (Fase 2 P0).

## Como funciona
Agendada pelo `pg_cron` a cada minuto (migration
[`0012_reminders.sql`](../../migrations/0012_reminders.sql)) via
`_invoke_edge_function` + Vault. O match temporal é feito **no banco** pela função
`claim_due_reminders(p_now, p_window_minutes)`, que **seleciona e marca**
(`last_sent_on`) atomicamente os lembretes devidos — respeitando o fuso do
usuário, uma **janela** (tolera execuções perdidas) e **idempotência** por data no
fuso (ADR-0005). Esta função então busca as `push_subscriptions` do usuário e
envia com `web-push` (concorrente, `Promise.allSettled`); subscriptions que
retornam 404/410 são removidas.

## Invocação (server-only)
```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-reminders" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## Deploy & secrets
```bash
supabase functions deploy send-reminders
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT="mailto:voce@dominio.com"
```
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase.

> Nota Deno: `web-push` é importado via `npm:` specifier. Caso o runtime apresente
> incompatibilidade de cripto, o fallback (ADR-0003) é assinatura VAPID (ES256) +
> `aes128gcm` via Web Crypto API.
