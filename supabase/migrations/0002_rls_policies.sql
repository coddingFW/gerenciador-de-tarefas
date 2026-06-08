-- 0002_rls_policies.sql — Row Level Security (Fase 1 §7.2)
-- GARANTIA central: o isolamento é imposto NO BANCO. Mesmo com bug no front ou
-- request forjado com token válido, o Postgres só retorna linhas do próprio dono.

alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.goals          enable row level security;
alter table public.tasks          enable row level security;
alter table public.execution_logs enable row level security;
alter table public.streaks        enable row level security;
alter table public.metrics        enable row level security;
alter table public.audit_logs     enable row level security;

-- ---------- profiles ----------
-- O dono lê/edita o próprio profile; admin pode ler todos (suporte).
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- IMPORTANTE: role/plan NÃO devem ser alteráveis pelo usuário. Isso é garantido
-- por trigger (0002b abaixo), pois RLS sozinha não restringe colunas.

-- ---------- categories / goals / tasks: owner-only (CRUD completo do dono) ----------
create policy categories_owner on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy goals_owner on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_owner on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- execution_logs: APPEND-ONLY ----------
-- Dono lê e insere os próprios logs. SEM policy de update/delete → o usuário não
-- consegue apagar/alterar histórico (correção = log compensatório).
create policy logs_select on public.execution_logs
  for select using (auth.uid() = user_id);
create policy logs_insert on public.execution_logs
  for insert with check (auth.uid() = user_id);

-- ---------- streaks: SOMENTE leitura do dono ----------
-- Escrita apenas via service_role (jobs). Impede "editar" a própria streak.
create policy streaks_select on public.streaks
  for select using (auth.uid() = user_id);

-- ---------- metrics: dono lê as suas; admin lê as globais ----------
create policy metrics_user_select on public.metrics
  for select using (scope = 'user' and auth.uid() = user_id);
create policy metrics_global_admin on public.metrics
  for select using (scope = 'global' and public.is_admin());

-- ---------- audit_logs: só admin lê; ninguém insere via cliente ----------
-- INSERT acontece apenas por Edge Functions usando service_role (ignora RLS).
create policy audit_admin_read on public.audit_logs
  for select using (public.is_admin());

-- Nota: 'service_role' (usado pelas Edge Functions) ignora RLS por padrão,
-- então jobs de métricas e escrita de auditoria funcionam sem policy explícita.

-- ---------- Proteção de colunas privilegiadas (role/plan) ----------
-- RLS controla LINHAS, não COLUNAS. Este trigger impede que o usuário comum
-- promova a si mesmo ou troque o próprio plano por update direto na profile.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.plan := old.plan;
  end if;
  return new;
end;
$$;
create trigger trg_protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();
