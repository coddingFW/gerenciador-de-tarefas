-- rls_isolation.test.sql — prova que um usuário NUNCA acessa dados de outro.
-- Roda com: supabase test db  (usa pgTAP). É o teste-guarda da Fase 1 §7.2/§11:
-- se a RLS regredir, o CI quebra.

begin;
select plan(4);

-- Dois usuários reais (o trigger handle_new_user cria os profiles).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev');

-- Passa a agir como cliente autenticado (sujeito à RLS).
set local role authenticated;

-- ---- Usuário A cria um goal ----
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
insert into public.goals (user_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'Goal A');

-- ---- Usuário B cria um goal ----
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
insert into public.goals (user_id, title) values
  ('22222222-2222-2222-2222-222222222222', 'Goal B');

-- ---- B só enxerga o próprio goal ----
select is(
  (select count(*)::int from public.goals),
  1,
  'usuário B vê apenas os próprios goals'
);
select is(
  (select count(*)::int from public.goals where title = 'Goal A'),
  0,
  'usuário B não vê goals do usuário A'
);

-- ---- B não consegue inserir goal em nome de A (with check) ----
select throws_ok(
  $$ insert into public.goals (user_id, title)
     values ('11111111-1111-1111-1111-111111111111', 'Hijack') $$,
  '42501',
  null,
  'usuário B não cria recurso em nome de A (violação de RLS)'
);

-- ---- B não consegue editar a própria role para admin ----
update public.profiles set role = 'admin'
  where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select role::text from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'user',
  'usuário B não consegue se promover a admin'
);

select * from finish();
rollback;
