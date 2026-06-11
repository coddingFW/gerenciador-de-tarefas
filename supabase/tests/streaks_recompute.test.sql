-- streaks_recompute.test.sql — prova que a streak derivada no servidor é idêntica
-- ao domínio (@habit/core StreakCalculator). Roda com: supabase test db (pgTAP).
-- Espelha os casos de packages/core/tests/StreakCalculator.test.ts, com datas
-- relativas a "hoje" (fuso UTC do profile) para ser determinístico no CI.
-- A streak é gravada pelo TRIGGER em cada insert de execution_logs.

begin;
select plan(11);

-- Usuário real (timezone UTC, igual ao default) — o trigger cria o profile.
insert into auth.users (id, email)
  values ('33333333-3333-3333-3333-333333333333', 's@test.dev');

-- "Hoje" como a função o enxerga (now() no fuso do usuário).
-- Guardado numa temp table para reuso nas asserções.
create temp table t (today date) on commit drop;
insert into t values ((now() at time zone 'UTC')::date);

-- Goals de cenário (todos do mesmo usuário, frequência diária).
insert into public.goals (id, user_id, title, frequency) values
  ('a0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'sem logs',  'daily'),
  ('a0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'tres hoje', 'daily'),
  ('a0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'ate ontem', 'daily'),
  ('a0000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'com lacuna','daily'),
  ('a0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'duplicado', 'daily');

-- Helper local: insere um log (o trigger recalcula a streak).
-- 3 dias consecutivos terminando hoje.
insert into public.execution_logs (user_id, goal_id, occurred_on, client_event_id)
select '33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000002', today - n, gen_random_uuid()
from t, generate_series(0, 2) as n;

-- 2 dias consecutivos terminando ONTEM.
insert into public.execution_logs (user_id, goal_id, occurred_on, client_event_id)
select '33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000003', today - n, gen_random_uuid()
from t, generate_series(1, 2) as n;

-- Lacuna: dois consecutivos no passado distante + um isolado depois.
insert into public.execution_logs (user_id, goal_id, occurred_on, client_event_id)
select '33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000004', today - d, gen_random_uuid()
from t, (values (30), (29), (26)) as v(d);

-- Mesmo dia repetido (dedup) + dia anterior → 2 dias distintos terminando hoje.
insert into public.execution_logs (user_id, goal_id, occurred_on, client_event_id)
select '33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000005', today - d, gen_random_uuid()
from t, (values (1), (0), (0)) as v(d);

-- ---- Asserções ----
-- 1. Sem logs → nenhuma linha de streak (equivale a zero).
select is(
  (select count(*)::int from public.streaks where goal_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'goal sem logs nao gera streak'
);

-- 2/3. Três consecutivos terminando hoje → current 3, best 3.
select is(
  (select current_count from public.streaks where goal_id = 'a0000000-0000-0000-0000-000000000002'),
  3, 'tres dias consecutivos ate hoje: current = 3'
);
select is(
  (select best_count from public.streaks where goal_id = 'a0000000-0000-0000-0000-000000000002'),
  3, 'tres dias consecutivos ate hoje: best = 3'
);

-- 4. Última execução ontem → mantém a streak atual (2).
select is(
  (select current_count from public.streaks where goal_id = 'a0000000-0000-0000-0000-000000000003'),
  2, 'ultima execucao ontem: current = 2'
);

-- 5/6. Lacuna → current zera, best preservado (2).
select is(
  (select current_count from public.streaks where goal_id = 'a0000000-0000-0000-0000-000000000004'),
  0, 'apos lacuna: current = 0'
);
select is(
  (select best_count from public.streaks where goal_id = 'a0000000-0000-0000-0000-000000000004'),
  2, 'apos lacuna: best preservado = 2'
);

-- 7. Logs duplicados no mesmo dia contam uma vez → 2 dias distintos.
select is(
  (select current_count from public.streaks where goal_id = 'a0000000-0000-0000-0000-000000000005'),
  2, 'logs duplicados no mesmo dia: current = 2'
);

-- ---- productivity_score: port fiel de ProductivityScore.compute (função pura) ----
-- Mesmos casos de packages/core/tests/ProductivityScore.test.ts.
select is(public.productivity_score(0, 0, 0, null, 0), 0,
  'entrada zerada -> 0');
select is(public.productivity_score(1, 1, 60, 60, 1000), 100,
  'tudo no maximo -> 100');
select is(
  public.productivity_score(0, 0, 600, 60, 0),
  public.productivity_score(0, 0, 60, 60, 0),
  'razao de tempo satura em 1 (passar da meta nao soma)'
);
select is(public.productivity_score(0.5, 0, 0, null, 0), 20,
  'apenas conclusao 0.5 com pesos padrao -> 20');

select * from finish();
rollback;
