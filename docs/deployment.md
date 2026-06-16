# Deploy — Habit Tracker (Fase 1)

Guia operacional para colocar o sistema em produção. Pré-requisito: projeto
Supabase provisionado e conta Vercel.

## 1. Banco de dados (Supabase)
Aplicar as migrations e validar RLS/pgTAP:
```bash
supabase link --project-ref <ref>
supabase db push            # aplica 0001..0011 em produção
supabase test db            # pgTAP: isolamento RLS + streak SQL × domínio
```

## 2. Segredos do Vault (uma vez — NUNCA commitar a service_role)
Necessários para os jobs do `pg_cron` (migration `0011`) chamarem as Edge Functions:
```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>',        'service_role_key');
```
Conferir o agendamento:
```sql
select jobname, schedule, active from cron.job;
-- recompute-metrics-daily  | 0 3 * * *   | t
-- event-dispatcher-5min    | */5 * * * * | t
```

## 3. Edge Functions
```bash
supabase functions deploy recompute-metrics
supabase functions deploy event-dispatcher
supabase functions deploy admin-api
```

## 4. Frontend (Vercel)
Config em [`vercel.json`](../vercel.json) (monorepo npm workspaces, SPA rewrite).
Variáveis de ambiente do projeto Vercel (Production):
| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto |
| `VITE_SUPABASE_ANON_KEY` | anon key (pública) |
| `VITE_SENTRY_DSN` | DSN do Sentry (opcional; vazio = sem telemetria) |

> A `service_role`, `ANTHROPIC_API_KEY` e `STRIPE_*` **nunca** vão ao Vercel/bundle —
> ficam apenas nos secrets das Edge Functions (`supabase secrets set ...`).

## 5. Auth (Google)
No painel Supabase → Auth → Providers → Google: preencher Client ID/Secret e
adicionar a URL de produção em **Redirect URLs** e `site_url`.

## 6. Verificação pós-deploy
- [ ] App abre na URL pública e login Google funciona.
- [ ] Criar hábito → concluir → aparece no Painel (sync com Supabase).
- [ ] `select * from cron.job_run_details order by start_time desc limit 5;` mostra execuções OK.
- [ ] Sentry recebe um erro de teste (em build com DSN).

## Automação futura (fora do escopo desta fase)
Deploy contínuo das functions no CI exige `SUPABASE_ACCESS_TOKEN`/`PROJECT_REF`
como secrets do repositório. Documentado como próximo passo para não introduzir
credenciais no pipeline antes da decisão de ambiente.
