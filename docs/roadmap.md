# Roadmap — Habit Tracker

Documento vivo. Lista as tarefas priorizadas para levar o projeto do estado atual
(núcleo completo e testado) até produção e às features de produto pendentes.

**Legenda de esforço:** 🟢 baixo (~1 dia) · 🟡 médio (2–4 dias) · 🔴 alto (1+ semana)
**Estado:** ✅ feito · 🔲 a fazer · 🚧 em progresso

> O núcleo já está pronto: hábitos, tarefas, categorias, dashboard, sync
> (push/pull/realtime), métricas server-side, RLS, PWA, E2E e CI. O foco do
> roadmap é **fechar o caminho até produção** e implementar as **features
> declaradas mas ainda não construídas**.

---

## Fase 1 — Fechar o loop de produção 🔴 — ✅ CÓDIGO-COMPLETO
*Objetivo: colocar no ar, de forma confiável, tudo o que já existe.*
Essa fase tem o maior retorno: destrava todo o trabalho já feito.

> **Status:** todos os artefatos de código/config/docs estão prontos e commitados.
> O que resta é **execução de operador** (exige Supabase CLI/Docker + credenciais,
> indisponíveis no ambiente de dev): `supabase db push`, `supabase test db`,
> popular o Vault, `supabase functions deploy` e o deploy na Vercel. Passo a passo
> em [deployment.md](deployment.md).

| # | Tarefa | Esforço | Estado |
|---|--------|---------|--------|
| 1.1 | Commitar `supabase/migrations/0010_grants.sql` (hoje uncommitted) | 🟢 | ✅ |
| 1.2 | Aplicar todas as migrations a um Postgres real (`supabase db push`) e validar RLS/pgTAP — **migrations `0001`→`0011` aplicadas limpas num projeto Supabase real em 2026-06-16 (inclui `0011` pg_cron/pg_net)**; pgTAP local (`supabase test db`) ainda pendente (depende de Docker) | 🟡 | 🚧 |
| 1.3 | Agendar as Edge Functions via `pg_cron`: `recompute-metrics` (diária) e `event-dispatcher` (5 min) — migration `0011_cron_jobs.sql` + Vault ([ADR-0001](adr/ADR-0001-pg-cron-scheduling.md)) | 🟡 | ✅ |
| 1.4 | Config de deploy do web (Vercel — [`vercel.json`](../vercel.json)) + deploy das Edge Functions (ver [deployment.md](deployment.md)) | 🟡 | ✅ |
| 1.5 | Inicializar Sentry no boot do app — `initSentry()` lazy/no-op ([ADR-0002](adr/ADR-0002-sentry-observability.md)) | 🟢 | ✅ |
| 1.6 | Atualizar README/CHANGELOG/architecture (status real, instruções de deploy) | 🟢 | ✅ |

**Pronto quando:** o app está acessível em URL pública, autentica via Google,
sincroniza com o Supabase, as métricas recalculam sozinhas em cron e erros chegam
ao Sentry.

---

## Fase 2 — Lembretes / notificações 🔴
*Objetivo: a feature central que falta num gerenciador de hábitos.*

| # | Tarefa | Esforço | Estado |
|---|--------|---------|--------|
| 2.1 | Modelo de domínio do lembrete (horário, dias da semana, hábito/tarefa alvo) + port `IReminderRepository` | 🟡 | 🔲 |
| 2.2 | Web Push: VAPID keys, registro de subscription, persistência no Supabase | 🟡 | 🔲 |
| 2.3 | Service worker recebe push e exibe notificação (PWA já existe como base) | 🟡 | 🔲 |
| 2.4 | Edge Function agendada que dispara os pushes no horário (respeitando timezone do perfil) | 🔴 | 🔲 |
| 2.5 | UI de configuração de lembretes por hábito | 🟡 | 🔲 |

**Pronto quando:** o usuário define um lembrete e recebe a notificação no horário,
no fuso correto, mesmo com o app fechado.

---

## Fase 3 — Conta e dados do usuário 🟡
*Objetivo: maturidade de produto e conformidade (LGPD/GDPR).*

| # | Tarefa | Esforço | Estado |
|---|--------|---------|--------|
| 3.1 | Tela de Configurações (ver/editar timezone, perfil, preferências) | 🟡 | 🔲 |
| 3.2 | Exportar dados do usuário (JSON/CSV) | 🟢 | 🔲 |
| 3.3 | Excluir conta + apagar dados (cascade respeitando logs imutáveis/anonimização) | 🟡 | 🔲 |

**Pronto quando:** o usuário consegue gerenciar o próprio fuso, exportar tudo e
solicitar exclusão da conta.

---

## Fase 4 — Monetização e IA 🔴
*Objetivo: diferenciais e receita. Ports já existem; faltam adapters.*

| # | Tarefa | Esforço | Estado |
|---|--------|---------|--------|
| 4.1 | Adapter Stripe para `IPaymentProvider` (checkout + webhook → atualiza `plan`) | 🔴 | 🔲 |
| 4.2 | Gating premium na UI (limites/funcionalidades por `plan`) | 🟡 | 🔲 |
| 4.3 | Adapter Anthropic para `IAIProvider` (Edge Function server-side) | 🟡 | 🔲 |
| 4.4 | UI de insights de IA + sugestão de hábitos no dashboard | 🟡 | 🔲 |

**Pronto quando:** existe um plano pago funcional (Stripe) e insights de IA no
painel para usuários elegíveis.

---

## Fase 5 — Painel administrativo 🟡
*Objetivo: dar interface ao que a `admin-api` já expõe.*

| # | Tarefa | Esforço | Estado |
|---|--------|---------|--------|
| 5.1 | Frontend admin (rota protegida por `role = 'admin'`) consumindo a `admin-api` | 🟡 | 🔲 |
| 5.2 | Visualizar métricas (DAU/WAU/MAU, retenção) e gerenciar feature flags com auditoria | 🟡 | 🔲 |

**Pronto quando:** um admin loga, vê métricas e liga/desliga feature flags pela UI.

---

## Ordem recomendada
**Fase 1 → 2 → 3 → 4 → 5.** A Fase 1 destrava o produto já construído (maior ROI);
a Fase 2 entrega a feature de produto mais sentida; 3 dá maturidade; 4 traz
receita/diferenciais; 5 é ferramenta interna.
