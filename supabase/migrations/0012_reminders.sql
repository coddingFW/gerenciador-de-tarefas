-- 0012_reminders.sql — Lembretes recorrentes + Web Push subscriptions (Fase 2 P0).
-- Convenções herdadas: toda tabela de usuário tem user_id + RLS (0002) + grants
-- por tabela (0010). time_local é o horário no FUSO do usuário (profiles.timezone).

-- ---------- reminders (recorrência simples: horário local + dias da semana) ----------
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  goal_id      uuid not null references public.goals on delete cascade,
  time_local   time not null,                       -- "HH:MM" no fuso do usuário
  weekdays     int[] not null
                 check (cardinality(weekdays) between 1 and 7
                        and weekdays <@ array[1,2,3,4,5,6,7]),  -- ISO-DOW 1=seg..7=dom
  active       boolean not null default true,
  last_sent_on date,                                -- idempotência (data no fuso do usuário)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_reminders_due on public.reminders (active, time_local) where active;
create trigger trg_reminders_updated before update on public.reminders
  for each row execute function public.set_updated_at();

-- ---------- push_subscriptions (endpoints Web Push por dispositivo) ----------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null unique,                  -- identidade do dispositivo/browser
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index idx_push_subs_user on public.push_subscriptions (user_id);

-- ---------- RLS: owner-only (CRUD do dono) ----------
alter table public.reminders          enable row level security;
alter table public.push_subscriptions enable row level security;

create policy reminders_owner on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_subs_owner on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Grants (espelha 0010: o que o dono pode por RLS, recebe GRANT) ----------
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ---------- Realtime: reminders sincroniza ao vivo (multi-dispositivo) ----------
-- push_subscriptions NÃO entra no realtime (é só upload; o servidor é o consumidor).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reminders'
  ) then
    execute 'alter publication supabase_realtime add table public.reminders';
  end if;
end $$;

-- ---------- claim_due_reminders: seleciona E marca (atômico) os lembretes vencendo ----------
-- Match temporal robusto (ADR-0005): usa o timestamp local do usuário (não só HH:MM),
-- com JANELA [agora-window, agora] (tolera execuções perdidas) e idempotência por
-- data no fuso (last_sent_on). O UPDATE ... RETURNING evita disparo duplo entre
-- execuções sobrepostas do cron. SECURITY DEFINER: roda como owner (ignora RLS),
-- exposto APENAS ao service_role.
create or replace function public.claim_due_reminders(
  p_now timestamptz default now(),
  p_window_minutes int default 5
)
returns table (reminder_id uuid, user_id uuid, goal_id uuid, goal_title text)
language sql
security definer
set search_path = public
as $$
  with due as (
    select r.id, r.user_id, r.goal_id,
           (p_now at time zone p.timezone)::date as local_date
    from public.reminders r
    join public.profiles p on p.id = r.user_id
    where r.active
      -- alvo de hoje (no fuso) já passou, mas dentro da janela:
      and ((p_now at time zone p.timezone)::date + r.time_local)
            <= (p_now at time zone p.timezone)
      and ((p_now at time zone p.timezone)::date + r.time_local)
            >  (p_now at time zone p.timezone) - make_interval(mins => p_window_minutes)
      and extract(isodow from (p_now at time zone p.timezone))::int = any(r.weekdays)
      and (r.last_sent_on is distinct from (p_now at time zone p.timezone)::date)
  )
  update public.reminders r
     set last_sent_on = due.local_date
    from due
   where r.id = due.id
  returning r.id, r.user_id, r.goal_id,
            (select g.title from public.goals g where g.id = r.goal_id);
$$;

revoke all on function public.claim_due_reminders(timestamptz, int) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(timestamptz, int) to service_role;

-- ---------- Cron: dispara o envio dos lembretes a cada minuto ----------
-- Reaproveita _invoke_edge_function (0011) + Vault. Idempotente (unschedule + schedule).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-reminders-1min') then
    perform cron.unschedule('send-reminders-1min');
  end if;
end $$;

select cron.schedule(
  'send-reminders-1min',
  '* * * * *',
  $$select public._invoke_edge_function('send-reminders', '{}'::jsonb);$$
);
