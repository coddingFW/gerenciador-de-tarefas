-- 0010_grants.sql — privilégios de TABELA para os papéis do PostgREST.
-- A RLS controla LINHAS; o GRANT controla o acesso à TABELA. Sem o grant, mesmo
-- com a policy correta o cliente recebe "permission denied for table". Espelha
-- exatamente as policies (0002/0005): o que o dono pode fazer por RLS, recebe
-- GRANT aqui. As views administrativas (0004) permanecem REVOGADAS — por isso
-- concedemos por tabela, nunca em "ALL TABLES" (que incluiria as views).

grant usage on schema public to anon, authenticated;

-- Dono: CRUD completo (categorias, hábitos, tarefas).
grant select, insert, update, delete
  on public.categories, public.goals, public.tasks
  to authenticated;

-- profiles: lê/atualiza o próprio (role/plan protegidos por trigger).
grant select, update on public.profiles to authenticated;

-- execution_logs: append-only (sem update/delete).
grant select, insert on public.execution_logs to authenticated;

-- Derivados: somente leitura do dono (escrita só via service_role/jobs).
grant select on public.streaks, public.metrics to authenticated;

-- feature_flags: todos os autenticados leem; a escrita é restrita a admin pela RLS.
grant select, insert, update, delete on public.feature_flags to authenticated;

-- audit_logs: admin lê (RLS); a escrita ocorre só via service_role (Edge Functions).
grant select on public.audit_logs to authenticated;

-- Observação: public.domain_events NÃO recebe grant — é server-only (service_role
-- ignora RLS/grants). As funções de job já foram revogadas em 0006/0007.
