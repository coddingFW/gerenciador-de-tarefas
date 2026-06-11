-- 0009_realtime.sql — habilita o Supabase Realtime (postgres_changes) nas tabelas
-- do usuário, para sincronização multi-dispositivo em tempo real. A RLS já em
-- vigor (0002) garante que cada cliente só recebe as PRÓPRIAS linhas; o servidor
-- não vaza dados de outros usuários pelo canal de realtime.
--
-- Idempotente: ignora tabelas já presentes na publicação (re-execução segura).
do $$
declare
  t text;
begin
  foreach t in array array[
    'goals', 'tasks', 'categories', 'execution_logs', 'profiles'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
