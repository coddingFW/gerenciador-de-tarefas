-- 0015_task_archive.sql — soft delete de tarefas avulsas (Fase 3).
-- Espelha o padrão de goals (archived_at): excluir = arquivar. RLS/grants de
-- tasks já cobrem UPDATE do dono (0002/0010); é só a coluna.

alter table public.tasks
  add column if not exists archived_at timestamptz;
