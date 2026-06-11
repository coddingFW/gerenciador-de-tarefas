-- 0006_metrics_recompute.sql — derivação autoritativa no servidor (Fase 1 §5/§8)
-- REGRA INVIOLÁVEL #2: streak e score são derivados NO SERVIDOR a partir dos
-- execution_logs (append-only). O cliente NUNCA os escreve. Estas funções são o
-- port fiel de @habit/core (StreakCalculator / ProductivityScore) para SQL, de
-- modo que o resultado seja idêntico ao domínio e comparável por teste.

-- ============================================================================
-- 1. recompute_streak — espelha StreakCalculator.computeDaily
-- ============================================================================
-- Frequência diária: dias consecutivos sem lacuna (gaps-and-islands). A streak
-- "atual" só conta se a última execução foi hoje ou ontem (no fuso do usuário).
-- SECURITY DEFINER: escreve em public.streaks (sem policy de escrita p/ cliente).
create or replace function public.recompute_streak(p_user_id uuid, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz      text;
  v_today   date;
  v_freq    public.goal_frequency;
  v_best    int  := 0;
  v_current int  := 0;
  v_last    date;
begin
  select coalesce(timezone, 'UTC') into v_tz
  from public.profiles where id = p_user_id;
  v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  select frequency into v_freq from public.goals where id = p_goal_id;
  if v_freq is null then v_freq := 'daily'; end if;

  -- Ilhas de dias consecutivos: (data - row_number) é constante dentro de uma
  -- sequência sem lacunas. Deduplica múltiplos logs no mesmo dia via DISTINCT.
  with days as (
    select distinct occurred_on as d
    from public.execution_logs
    where user_id = p_user_id and goal_id = p_goal_id
  ),
  grp as (
    select d, d - (row_number() over (order by d))::int as island from days
  ),
  runs as (
    select count(*)::int as len, max(d) as last_d from grp group by island
  )
  select
    coalesce(max(len), 0),
    coalesce(max(case when last_d = (select max(last_d) from runs) then len end), 0),
    (select max(last_d) from runs)
  into v_best, v_current, v_last
  from runs;

  -- Sem nenhum log: remove o cache (volta a zero).
  if v_last is null then
    delete from public.streaks
    where user_id = p_user_id and goal_id = p_goal_id and period_type = v_freq;
    return;
  end if;

  -- current só vale se a última execução foi hoje ou ontem.
  if v_last < v_today - 1 then
    v_current := 0;
  end if;

  insert into public.streaks
    (user_id, goal_id, current_count, best_count, last_execution_on, period_type, updated_at)
  values
    (p_user_id, p_goal_id, v_current, v_best, v_last, v_freq, now())
  on conflict (user_id, goal_id, period_type) do update set
    current_count     = excluded.current_count,
    best_count        = greatest(public.streaks.best_count, excluded.best_count),
    last_execution_on = excluded.last_execution_on,
    updated_at        = now();
end;
$$;

-- Recalcula todas as streaks (diárias) de um usuário — usado em backfill/jobs.
create or replace function public.recompute_user_streaks(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal uuid;
  v_count int := 0;
begin
  for v_goal in
    select id from public.goals where user_id = p_user_id and frequency = 'daily'
  loop
    perform public.recompute_streak(p_user_id, v_goal);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Trigger: todo execution_log inserido recalcula a streak do seu goal, na MESMA
-- transação. Garante que a streak é sempre derivada dos logs, independente de
-- qualquer Edge Function estar no ar — a derivação não pode "ficar para trás".
create or replace function public.tg_recompute_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.goal_id is not null then
    perform public.recompute_streak(new.user_id, new.goal_id);
  end if;
  return new;
end;
$$;

create trigger trg_execution_logs_streak
  after insert on public.execution_logs
  for each row execute function public.tg_recompute_streak();

-- ============================================================================
-- 2. productivity_score — port fiel de ProductivityScore.compute (função PURA)
-- ============================================================================
-- score = w1*conclusão + w2*aderência + w3*razãoTempo(sat) + w4*bônusStreak(sat)
-- Pesos padrão somam 1.0 → normalização trivial. Resultado em 0..100.
create or replace function public.productivity_score(
  p_completion     numeric,
  p_adherence      numeric,
  p_minutes_spent  numeric,
  p_target_minutes numeric,
  p_streak_count   int
)
returns int
language sql
immutable
as $$
  with c as (
    select
      least(1, greatest(0, coalesce(p_completion, 0))) as completion,
      least(1, greatest(0, coalesce(p_adherence, 0)))  as adherence,
      case
        when p_target_minutes is null or p_target_minutes <= 0
          then case when coalesce(p_minutes_spent, 0) > 0 then 1 else 0 end
        else least(1, greatest(0, coalesce(p_minutes_spent, 0) / p_target_minutes))
      end as time_ratio,
      case
        when coalesce(p_streak_count, 0) <= 0 then 0
        else 1 - exp(-p_streak_count::numeric / 7)
      end as streak_bonus
  )
  select round(
    least(1, greatest(0,
      0.4 * completion + 0.3 * adherence + 0.2 * time_ratio + 0.1 * streak_bonus
    )) * 100
  )::int
  from c;
$$;

-- ============================================================================
-- 3. compute_daily_score — agrega os insumos do dia e grava em metrics
-- ============================================================================
-- Semântica DIÁRIA (escolha de produto, revisável):
--   conclusão  = tarefas done / acionáveis com due_date no dia
--   aderência  = hábitos diários ativos executados no dia / hábitos diários ativos
--   minutos    = soma de minutes_spent dos logs do dia (hábitos diários)
--   alvo       = soma de target_minutes dos hábitos diários ativos
--   streak     = média (arredondada) das streaks atuais dos hábitos diários
-- Grava como metric_key='daily_score', scope='user', period='day'.
create or replace function public.compute_daily_score(p_user_id uuid, p_day date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goals_total  int;
  v_goals_done   int;
  v_minutes      numeric;
  v_target       numeric;
  v_streak       int;
  v_tasks_done   int;
  v_tasks_total  int;
  v_completion   numeric;
  v_adherence    numeric;
  v_score        int;
begin
  select count(*),
         coalesce(sum(target_minutes), 0)
    into v_goals_total, v_target
  from public.goals
  where user_id = p_user_id and active and frequency = 'daily';

  select count(distinct el.goal_id),
         coalesce(sum(el.minutes_spent), 0)
    into v_goals_done, v_minutes
  from public.execution_logs el
  join public.goals g on g.id = el.goal_id
  where el.user_id = p_user_id
    and el.occurred_on = p_day
    and g.active and g.frequency = 'daily';

  select coalesce(round(avg(s.current_count)), 0)::int
    into v_streak
  from public.streaks s
  join public.goals g on g.id = s.goal_id
  where s.user_id = p_user_id and s.period_type = 'daily' and g.active;

  select count(*) filter (where status = 'done'),
         count(*) filter (where status in ('done', 'pending', 'skipped'))
    into v_tasks_done, v_tasks_total
  from public.tasks
  where user_id = p_user_id and due_date = p_day;

  v_completion := case when v_tasks_total > 0 then v_tasks_done::numeric / v_tasks_total else 0 end;
  v_adherence  := case when v_goals_total > 0 then v_goals_done::numeric / v_goals_total else 0 end;

  v_score := public.productivity_score(
    v_completion, v_adherence, v_minutes, nullif(v_target, 0), v_streak
  );

  insert into public.metrics (user_id, scope, metric_key, period, period_start, value, computed_at)
  values (p_user_id, 'user', 'daily_score', 'day', p_day, v_score, now())
  on conflict (
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    scope, metric_key, period, period_start
  ) do update set value = excluded.value, computed_at = now();

  return v_score;
end;
$$;

-- ============================================================================
-- 4. refresh_metrics_views — atualiza a matview de retenção (chamada por job)
-- ============================================================================
create or replace function public.refresh_metrics_views()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.mv_retention_cohort;
exception when feature_not_supported or object_not_in_prerequisite_state then
  -- 1ª execução (matview ainda não populada) não permite CONCURRENTLY.
  refresh materialized view public.mv_retention_cohort;
end;
$$;

-- Apenas service_role (Edge Functions) executa os jobs de agregação/refresh.
revoke all on function public.recompute_user_streaks(uuid)      from anon, authenticated;
revoke all on function public.compute_daily_score(uuid, date)   from anon, authenticated;
revoke all on function public.refresh_metrics_views()           from anon, authenticated;
