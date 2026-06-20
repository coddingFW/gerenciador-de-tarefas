# ADR-0009 — Exportação e exclusão de conta (LGPD)

- **Status:** Aceito
- **Data:** 2026-06-20
- **Fase:** 3 (Conta e dados) — produto lançável

## Contexto
Para lançar, o app precisa atender a portabilidade e o direito ao esquecimento
(LGPD/GDPR): o usuário deve poder exportar seus dados e excluir a conta.

## Decisões
1. **Exportar = JSON no cliente.** Um único arquivo (perfil, categorias, hábitos,
   tarefas, lembretes, execução de logs) gerado a partir do Dexie — offline-first,
   sem servidor, sem novas permissões. Remove o campo interno `_sync`.
2. **Excluir = apagar tudo (hard delete)** via Edge Function `delete-account`:
   - chamada pelo PRÓPRIO usuário com seu JWT; a função identifica o `userId` pelo
     token (só pode excluir a si mesmo) e usa `service_role` para
     `auth.admin.deleteUser`.
   - as FKs `on delete cascade` em `auth.users` apagam profiles/goals/tasks/
     categories/execution_logs/reminders/push_subscriptions/streaks.
   - `domain_events` (server-only, sem cascade garantido) é limpo antes (best-effort).
   - no cliente: confirmação em 2 passos → invoca a função → `signOut` → `localDB.delete()`
     + `localStorage.clear()` → reload.
   - em modo demo (sem backend), apaga só os dados locais.

## Alternativas rejeitadas
- **Anonimizar** em vez de apagar: mantém logs desvinculados para métricas; mais
  complexo e desnecessário para um app pessoal. Hard delete é mais aderente ao
  "direito ao esquecimento".
- **Exclusão pelo cliente** (sem Edge Function): impossível — `deleteUser` exige
  `service_role`, que nunca vai ao bundle.
- **Export CSV**: menos fiel às relações; JSON cobre portabilidade com 1 arquivo.

## Consequências
- ✅ Portabilidade e erasure atendidos; sem migration (cascade já existia).
- ✅ `service_role` continua server-only; usuário só exclui a si mesmo.
- ⚠️ `delete-account` precisa ser **deployada** (`verify_jwt = true`).
- ⚠️ Resíduos possíveis fora do cascade (ex.: `domain_events` se o nome de coluna
  divergir) são tratados best-effort — revisar se surgir outra tabela server-only
  com PII.
