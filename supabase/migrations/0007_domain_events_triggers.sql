-- 0007_domain_events_triggers.sql — Transactional Outbox: produção de eventos
-- (Fase 1 §6). Toda mutação de domínio grava um evento em domain_events na MESMA
-- transação, via trigger. O event-dispatcher (Edge Function) consome a fila.
-- Catálogo de tipos espelha @habit/core (domain/events): GoalCreated,
-- ExecutionLogged, TaskCompleted.

-- Helper server-only: insere no outbox. SECURITY DEFINER porque domain_events
-- tem RLS habilitada SEM policies de cliente (só service_role lê/escreve).
create or replace function public.emit_domain_event(
  p_event_type     text,
  p_aggregate_type text,
  p_aggregate_id   uuid,
  p_user_id        uuid,
  p_payload        jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.domain_events (event_type, aggregate_type, aggregate_id, user_id, payload)
  values (p_event_type, p_aggregate_type, p_aggregate_id, p_user_id, coalesce(p_payload, '{}'::jsonb));
$$;

-- ---------- goals → GoalCreated ----------
create or replace function public.tg_emit_goal_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.emit_domain_event(
    'GoalCreated', 'goal', new.id, new.user_id,
    jsonb_build_object('frequency', new.frequency, 'target_count', new.target_count)
  );
  return new;
end;
$$;
create trigger trg_goals_event
  after insert on public.goals
  for each row execute function public.tg_emit_goal_created();

-- ---------- execution_logs → ExecutionLogged ----------
-- occurred_on no payload permite ao dispatcher recalcular o score do dia certo.
create or replace function public.tg_emit_execution_logged()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.emit_domain_event(
    'ExecutionLogged', 'execution_log', new.id, new.user_id,
    jsonb_build_object(
      'goal_id', new.goal_id, 'task_id', new.task_id,
      'occurred_on', new.occurred_on, 'minutes_spent', new.minutes_spent
    )
  );
  return new;
end;
$$;
create trigger trg_logs_event
  after insert on public.execution_logs
  for each row execute function public.tg_emit_execution_logged();

-- ---------- tasks → TaskCompleted (apenas na transição para 'done') ----------
create or replace function public.tg_emit_task_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    perform public.emit_domain_event(
      'TaskCompleted', 'task', new.id, new.user_id,
      jsonb_build_object('goal_id', new.goal_id, 'due_date', new.due_date)
    );
  end if;
  return new;
end;
$$;
create trigger trg_tasks_event
  after update on public.tasks
  for each row execute function public.tg_emit_task_completed();

-- ---------- consumo: marca eventos como processados ----------
-- O dispatcher lê os pendentes, executa os efeitos (idempotentes) e só então
-- marca como processados (entrega at-least-once segura — recompute é idempotente).
create or replace function public.mark_events_processed(p_ids uuid[])
returns int
language sql
security definer
set search_path = ''
as $$
  with upd as (
    update public.domain_events
       set processed_at = now()
     where id = any(p_ids) and processed_at is null
    returning 1
  )
  select count(*)::int from upd;
$$;

revoke all on function public.emit_domain_event(text, text, uuid, uuid, jsonb) from anon, authenticated;
revoke all on function public.mark_events_processed(uuid[])                    from anon, authenticated;
