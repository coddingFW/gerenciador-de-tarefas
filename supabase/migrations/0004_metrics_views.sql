-- 0004_metrics_views.sql — camada analítica (Fase 1 §9 / §15)
-- A grande vantagem do Supabase: estas métricas são SQL nativo. As views são
-- de uso ADMINISTRATIVO (agregam todos os usuários) → acesso só via service_role.

-- DAU: usuários distintos com execução por dia.
create or replace view public.v_dau as
  select occurred_on as day, count(distinct user_id) as dau
  from public.execution_logs
  group by occurred_on;

-- WAU/MAU: janelas móveis a partir do dia corrente.
create or replace view public.v_active_users as
  select
    count(distinct user_id) filter (where occurred_on >= current_date - 6)  as wau,
    count(distinct user_id) filter (where occurred_on >= current_date - 29) as mau
  from public.execution_logs;

-- Taxa de conclusão global (done / total acionável).
create or replace view public.v_completion_rate as
  select
    count(*) filter (where status = 'done')::numeric
      / nullif(count(*) filter (where status in ('done', 'pending', 'skipped')), 0) as completion_rate
  from public.tasks;

-- Horários de maior uso (histograma por hora UTC).
create or replace view public.v_usage_by_hour as
  select extract(hour from occurred_at)::int as hour, count(*) as executions
  from public.execution_logs
  group by 1
  order by 1;

-- Hábitos mais usados (por título normalizado).
create or replace view public.v_top_habits as
  select lower(trim(g.title)) as habit, count(*) as executions
  from public.execution_logs el
  join public.goals g on g.id = el.goal_id
  group by 1
  order by executions desc;

-- Retenção por cohort semanal (D7). Materializada: refresh agendado pelo job.
create materialized view public.mv_retention_cohort as
  select
    date_trunc('week', p.created_at)::date as cohort_week,
    count(distinct p.id) as cohort_size,
    count(distinct el.user_id) filter (
      where el.occurred_on between (p.created_at::date + 7) and (p.created_at::date + 13)
    ) as retained_d7
  from public.profiles p
  left join public.execution_logs el on el.user_id = p.id
  group by 1;
create unique index uq_retention_cohort on public.mv_retention_cohort (cohort_week);

-- As views agregam dados de TODOS os usuários e rodam como o owner (postgres),
-- contornando RLS. Por isso, revogamos acesso de anon/authenticated: só o
-- service_role (Edge Functions do painel admin) pode consultá-las.
revoke all on public.v_dau,
              public.v_active_users,
              public.v_completion_rate,
              public.v_usage_by_hour,
              public.v_top_habits,
              public.mv_retention_cohort
  from anon, authenticated;
