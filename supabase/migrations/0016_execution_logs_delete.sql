-- 0016_execution_logs_delete.sql — undo de conclusão (liga-desliga)
--
-- REVISÃO da decisão append-only de 0002. Para um tracker PESSOAL, concluir e
-- desfazer um hábito é um liga-desliga; as métricas devem refletir a remoção
-- (se não fez, não conta). O DONO passa a poder apagar os PRÓPRIOS logs; demais
-- usuários seguem sem acesso (RLS). Não há policy de UPDATE — logs continuam
-- imutáveis em conteúdo; só permitimos remover.
create policy logs_delete on public.execution_logs
  for delete using (auth.uid() = user_id);

-- A streak é derivada dos logs (regra inviolável #2). O trigger de INSERT
-- (0006) não cobre remoção; este recalcula na DELETE usando OLD, na mesma
-- transação, para a streak nunca "ficar para trás".
create or replace function public.tg_recompute_streak_del()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.goal_id is not null then
    perform public.recompute_streak(old.user_id, old.goal_id);
  end if;
  return old;
end;
$$;

create trigger trg_execution_logs_streak_del
  after delete on public.execution_logs
  for each row execute function public.tg_recompute_streak_del();
