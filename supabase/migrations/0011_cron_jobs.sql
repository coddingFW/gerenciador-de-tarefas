-- 0011_cron_jobs.sql — agendamento server-side dos jobs de agregação (Fase 1 §8).
--
-- As Edge Functions `recompute-metrics` (reconciliação diária) e `event-dispatcher`
-- (drenar o outbox `domain_events`) já existem e se autorizam por service_role.
-- Esta migration as AGENDA no banco via pg_cron + pg_net, sem nunca colocar a
-- service_role em texto plano: a URL do projeto e a key são lidas do Supabase
-- Vault (`vault.decrypted_secrets`) em tempo de execução. Ver
-- docs/adr/ADR-0001-pg-cron-scheduling.md.
--
-- PRÉ-REQUISITO OPERACIONAL (uma vez, fora do versionamento — NUNCA commitar a key):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',        'service_role_key');
--
-- Idempotente: re-execução re-agenda os mesmos jobs sem duplicar (unschedule + schedule).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper privilegiado: monta e dispara o POST para uma Edge Function, lendo
-- URL + service_role do Vault. SECURITY DEFINER para que o job do cron (que roda
-- como o owner) tenha acesso ao Vault; revogamos o EXECUTE de anon/authenticated.
create or replace function public._invoke_edge_function(p_fn text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url   text;
  v_key   text;
  v_reqid bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise warning '[cron] segredos do Vault ausentes (project_url/service_role_key); job %.', p_fn;
    return null;
  end if;

  select net.http_post(
    url     := v_url || '/functions/v1/' || p_fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := p_body
  ) into v_reqid;
  return v_reqid;
end;
$$;

revoke all on function public._invoke_edge_function(text, jsonb) from public, anon, authenticated;

-- (Re)agendamento idempotente.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'recompute-metrics-daily') then
    perform cron.unschedule('recompute-metrics-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'event-dispatcher-5min') then
    perform cron.unschedule('event-dispatcher-5min');
  end if;
end $$;

-- Reconciliação de streaks + score diário + refresh das views: toda madrugada (03:00 UTC).
select cron.schedule(
  'recompute-metrics-daily',
  '0 3 * * *',
  $$select public._invoke_edge_function('recompute-metrics', '{}'::jsonb);$$
);

-- Drenar o outbox de domain events: a cada 5 minutos (entrega at-least-once).
select cron.schedule(
  'event-dispatcher-5min',
  '*/5 * * * *',
  $$select public._invoke_edge_function('event-dispatcher', '{"limit":200}'::jsonb);$$
);
