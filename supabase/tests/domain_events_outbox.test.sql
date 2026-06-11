-- domain_events_outbox.test.sql — prova que cada mutação de domínio grava o
-- evento correto no outbox (Transactional Outbox, migration 0007).
-- Roda com: supabase test db (pgTAP).

begin;
select plan(5);

insert into auth.users (id, email)
  values ('44444444-4444-4444-4444-444444444444', 'o@test.dev');

-- ---- goal insert → GoalCreated ----
insert into public.goals (id, user_id, title, frequency)
  values ('b0000000-0000-0000-0000-000000000001',
          '44444444-4444-4444-4444-444444444444', 'ler', 'daily');
select is(
  (select count(*)::int from public.domain_events
     where event_type = 'GoalCreated' and aggregate_id = 'b0000000-0000-0000-0000-000000000001'),
  1, 'insert de goal emite GoalCreated'
);

-- ---- execution_log insert → ExecutionLogged (payload com occurred_on) ----
insert into public.execution_logs (user_id, goal_id, occurred_on, client_event_id)
  values ('44444444-4444-4444-4444-444444444444',
          'b0000000-0000-0000-0000-000000000001', current_date, gen_random_uuid());
select is(
  (select count(*)::int from public.domain_events
     where event_type = 'ExecutionLogged' and user_id = '44444444-4444-4444-4444-444444444444'),
  1, 'insert de execution_log emite ExecutionLogged'
);
select is(
  (select (payload ->> 'occurred_on')::date from public.domain_events
     where event_type = 'ExecutionLogged' and user_id = '44444444-4444-4444-4444-444444444444'),
  current_date, 'ExecutionLogged carrega occurred_on no payload'
);

-- ---- task done → TaskCompleted, apenas na transição ----
insert into public.tasks (id, user_id, goal_id, title, status)
  values ('c0000000-0000-0000-0000-000000000001',
          '44444444-4444-4444-4444-444444444444',
          'b0000000-0000-0000-0000-000000000001', 'tarefa', 'pending');
update public.tasks set status = 'done' where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.domain_events
     where event_type = 'TaskCompleted' and aggregate_id = 'c0000000-0000-0000-0000-000000000001'),
  1, 'transicao para done emite TaskCompleted'
);

-- update que NÃO muda o status não reemite.
update public.tasks set title = 'tarefa 2' where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.domain_events
     where event_type = 'TaskCompleted' and aggregate_id = 'c0000000-0000-0000-0000-000000000001'),
  1, 'update sem mudanca de status nao reemite TaskCompleted'
);

select * from finish();
rollback;
