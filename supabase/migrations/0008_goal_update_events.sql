-- 0008_goal_update_events.sql — completa o outbox para edição/arquivamento de
-- hábitos (use-cases EditGoal/ArchiveGoal). O SyncEngine envia o goal via upsert;
-- quando a linha já existe, vira UPDATE e este trigger emite o evento certo.
-- Mantém a invariante "toda mutação de domínio emite um evento" (Fase 1 §6).

create or replace function public.tg_emit_goal_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.active and not new.active then
    perform public.emit_domain_event(
      'GoalArchived', 'goal', new.id, new.user_id, jsonb_build_object('archived', true)
    );
  elsif not old.active and new.active then
    perform public.emit_domain_event(
      'GoalArchived', 'goal', new.id, new.user_id, jsonb_build_object('archived', false)
    );
  elsif new.title         is distinct from old.title
     or new.frequency     is distinct from old.frequency
     or new.target_count  is distinct from old.target_count
     or new.target_minutes is distinct from old.target_minutes
     or new.category_id   is distinct from old.category_id
     or new.description   is distinct from old.description then
    perform public.emit_domain_event(
      'GoalUpdated', 'goal', new.id, new.user_id,
      jsonb_build_object('frequency', new.frequency, 'target_count', new.target_count)
    );
  end if;
  return new;
end;
$$;

create trigger trg_goals_changed_event
  after update on public.goals
  for each row execute function public.tg_emit_goal_changed();
