-- 0001_init.sql — schema base (Fase 1 §4 / Fase 2 §5)
-- Convenções: toda tabela de usuário tem user_id para RLS; datas "de dia"
-- (occurred_on, due_date) representam o dia no fuso do usuário.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role      as enum ('user', 'admin');
create type user_plan      as enum ('free', 'premium');
create type goal_frequency as enum ('daily', 'weekly', 'monthly');
create type goal_type      as enum ('habit', 'one_off');
create type task_status    as enum ('pending', 'done', 'skipped');
create type execution_source as enum ('manual', 'timer', 'import');

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (espelho de auth.users) ----------
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  role         user_role not null default 'user',
  plan         user_plan not null default 'free',
  timezone     text not null default 'UTC',
  onboarding_completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o profile automaticamente quando um usuário se cadastra (Google OAuth).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper de autorização: admin sem recursão de RLS (SECURITY DEFINER ignora RLS).
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------- categories ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  color      text,
  icon       text,
  archived   boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- goals (aggregate root) ----------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  category_id   uuid references public.categories on delete set null,
  title         text not null,
  description   text,
  type          goal_type not null default 'habit',
  frequency     goal_frequency not null default 'daily',
  target_count  int not null default 1 check (target_count > 0),
  target_minutes int check (target_minutes is null or target_minutes >= 0),
  active        boolean not null default true,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_goals_user on public.goals (user_id) where active;
create trigger trg_goals_updated before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------- tasks ----------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  goal_id      uuid references public.goals on delete cascade,
  category_id  uuid references public.categories on delete set null,
  title        text not null,
  due_date     date,
  status       task_status not null default 'pending',
  estimated_minutes int,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index idx_tasks_today on public.tasks (user_id, due_date) where status = 'pending';

-- ---------- execution_logs (FATO IMUTÁVEL / append-only) ----------
create table public.execution_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  goal_id         uuid references public.goals on delete cascade,
  task_id         uuid references public.tasks on delete set null,
  occurred_on     date not null,                 -- dia no fuso do usuário
  occurred_at     timestamptz not null default now(),
  minutes_spent   int not null default 0 check (minutes_spent >= 0),
  source          execution_source not null default 'manual',
  client_event_id uuid not null,                 -- idempotência offline
  created_at      timestamptz not null default now(),
  unique (user_id, client_event_id)
);
create index idx_logs_streak on public.execution_logs (user_id, goal_id, occurred_on);
create index idx_logs_day    on public.execution_logs (occurred_on);

-- ---------- streaks (DERIVADO / cacheado) ----------
create table public.streaks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  goal_id          uuid not null references public.goals on delete cascade,
  current_count    int not null default 0,
  best_count       int not null default 0,
  last_execution_on date,
  period_type      goal_frequency not null default 'daily',
  updated_at       timestamptz not null default now(),
  unique (user_id, goal_id, period_type)
);

-- ---------- metrics (snapshots agregados) ----------
create table public.metrics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade,  -- null = global
  scope        text not null check (scope in ('user', 'global')),
  metric_key   text not null,
  period       text not null check (period in ('day', 'week', 'month')),
  period_start date not null,
  value        numeric not null,
  computed_at  timestamptz not null default now()
);
-- Unicidade tratando user_id null (global) como uuid sentinela.
create unique index uq_metrics on public.metrics (
  coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
  scope, metric_key, period, period_start
);

-- ---------- audit_logs (governança) ----------
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid not null,
  actor_role      user_role not null,
  action          text not null,
  target_resource text not null,
  target_id       uuid,
  metadata        jsonb not null default '{}',
  ip              text,
  user_agent      text,
  timestamp       timestamptz not null default now()
);
create index idx_audit_time on public.audit_logs (timestamp desc);
