-- 0003_domain_events_outbox.sql — Transactional Outbox (Fase 1 §6)
-- Toda mutação de domínio grava um evento aqui na MESMA transação. Um dispatcher
-- (Edge Function) processa os não-processados e os encaminha aos consumidores
-- (métricas, auditoria, analytics, IA).

create table public.domain_events (
  id             uuid primary key default gen_random_uuid(),
  event_type     text not null,
  aggregate_type text not null,
  aggregate_id   uuid,
  user_id        uuid,
  payload        jsonb not null default '{}',
  schema_version int not null default 1,
  occurred_at    timestamptz not null default now(),
  processed_at   timestamptz
);

-- Fila de pendentes: índice parcial mantém a varredura do dispatcher barata.
create index idx_events_unprocessed on public.domain_events (occurred_at)
  where processed_at is null;
create index idx_events_user on public.domain_events (user_id, occurred_at desc);

-- Server-only: RLS habilitada SEM policies de cliente. Apenas service_role
-- (Edge Functions) escreve/lê. O cliente nunca toca o outbox diretamente.
alter table public.domain_events enable row level security;
