-- 0005_feature_flags.sql — Feature Flags (Fase 1 §10)
-- Liberação gradual, beta, recursos só-admin e gating por plano (monetização).

create table public.feature_flags (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null unique,
  description        text,
  enabled_global     boolean not null default false,
  rollout_percentage int not null default 0 check (rollout_percentage between 0 and 100),
  enabled_for_roles  text[] not null default '{}',
  enabled_for_plans  text[] not null default '{}',
  enabled_for_users  uuid[] not null default '{}',
  updated_by         uuid,
  updated_at         timestamptz not null default now()
);

-- Avaliação determinística: o mesmo usuário não "pisca" entre on/off no rollout.
-- Combina habilitação global, por role/plan/usuário e % por hash estável.
create or replace function public.is_feature_enabled(p_key text)
returns boolean language sql security definer set search_path = '' stable as $$
  with ctx as (
    select auth.uid() as uid, p.role::text as role, p.plan::text as plan
    from public.profiles p where p.id = auth.uid()
  ), f as (
    select * from public.feature_flags where key = p_key
  )
  select coalesce((
    select
      f.enabled_global
      or (ctx.uid = any(f.enabled_for_users))
      or (ctx.role = any(f.enabled_for_roles))
      or (ctx.plan = any(f.enabled_for_plans))
      or (
        f.rollout_percentage > 0
        -- bit(24)::int é sempre positivo (0..16777215) → bucket estável 0..99
        and (('x' || substr(md5(p_key || ctx.uid::text), 1, 6))::bit(24)::int % 100)
            < f.rollout_percentage
      )
    from f, ctx
  ), false);
$$;

-- Leitura: qualquer usuário autenticado pode consultar o catálogo (a avaliação
-- por usuário usa is_feature_enabled). Escrita: somente admin.
alter table public.feature_flags enable row level security;
create policy flags_read on public.feature_flags
  for select using (auth.role() = 'authenticated');
create policy flags_admin_write on public.feature_flags
  for all using (public.is_admin()) with check (public.is_admin());
