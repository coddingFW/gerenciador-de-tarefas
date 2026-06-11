-- admin_access.test.sql — garante o modelo de acesso administrativo:
--  • só admin escreve feature_flags (RLS flags_admin_write);
--  • usuário 'authenticated' NÃO lê as views administrativas (GRANT revogado);
--  • a auditoria é legível só por admin.
-- Roda com: supabase test db (pgTAP).

begin;
select plan(4);

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'admin@test.dev'),
  ('66666666-6666-6666-6666-666666666666', 'user@test.dev');

-- Promove 55 a admin. O trigger protect_profile_privileges reverteria a troca
-- de role (não somos admin no contexto da migration), então o desligamos aqui.
alter table public.profiles disable trigger trg_protect_profile_privileges;
update public.profiles set role = 'admin'
  where id = '55555555-5555-5555-5555-555555555555';
alter table public.profiles enable trigger trg_protect_profile_privileges;

insert into public.feature_flags (key, enabled_global) values ('test_flag', false);

-- Passa a agir como cliente autenticado (sujeito à RLS e aos GRANTs).
set local role authenticated;

-- ---- não-admin NÃO altera a flag (RLS USING is_admin() → 0 linhas) ----
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
update public.feature_flags set enabled_global = true where key = 'test_flag';
select is(
  (select enabled_global from public.feature_flags where key = 'test_flag'),
  false, 'usuario comum nao altera feature_flags'
);

-- ---- não-admin NÃO lê as views administrativas (GRANT revogado) ----
select throws_ok(
  $$ select * from public.v_dau $$,
  '42501', null,
  'usuario comum nao le a view administrativa v_dau'
);

-- ---- admin ALTERA a flag ----
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
update public.feature_flags set enabled_global = true where key = 'test_flag';
select is(
  (select enabled_global from public.feature_flags where key = 'test_flag'),
  true, 'admin altera feature_flags'
);

-- ---- audit_logs só é legível por admin ----
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.audit_logs),
  0, 'usuario comum nao le audit_logs'
);

select * from finish();
rollback;
