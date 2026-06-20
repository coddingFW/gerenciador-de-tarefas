# ADR-0008 — Calendário sem dependências externas

- **Status:** Aceito
- **Data:** 2026-06-19
- **Feature:** Aba Calendário (tarefas + atividade de hábitos)

## Contexto
Adicionar uma aba Calendário com dois modos (Mês | Agenda) que mostra tarefas por
data e a atividade de hábitos como heatmap. O app é offline-first, mobile-first e
de bundle mínimo. `tasks.dueDate` e `execution_logs.occurredOn` já existem e estão
indexados no Dexie.

## Decisão
- **Sem lib de calendário.** Grade em **CSS grid** (7 colunas) e aritmética de mês
  em `dateUtils.ts` (UTC apenas para layout — dias no mês / dia da semana inicial).
- **Datas no fuso do usuário.** "Hoje"/"atrasada"/agrupamento usam
  `container.clock.today(timezone)` (`profiles.timezone`), nunca UTC do dispositivo.
- **Leitura local.** `useLiveQuery` lê tarefas (não arquivadas, `goalId = null`) e
  execuções (`goalId != null`); a agregação por dia (pontos + contagem do heatmap)
  é feita no cliente. Sem migration, sem env, sem processamento no servidor.
- **Reaproveitamento.** Ações reusam `CompleteTask`/`ReopenTask`/`ArchiveTask`;
  criar-com-data reusa `CreateTask` (já aceita `dueDate`); remarcar usa o novo
  use-case **`EditTask`** (regra de data no domínio, não na UI).
- **Heatmap.** Conta execuções de hábitos por dia em 4 níveis (0 / 1–2 / 3–4 / 5+);
  tarefas aparecem como pontos (azul=pendente, verde=concluída), fora do heatmap.

## Alternativas avaliadas
- **Lib (FullCalendar/react-day-picker):** rejeitada — peso no bundle e estilo
  destoante; a grade é simples o bastante em CSS.
- **Agregar heatmap no servidor (view/RPC):** rejeitada — quebraria offline-first
  e exigiria ida ao banco; o volume local é pequeno.
- **Regra de "atraso"/remarcação na UI:** rejeitada — viola a separação de camadas;
  vive no domínio (`EditTask`, comparação de `dueDate`).

## Consequências
- ✅ Bundle praticamente inalterado; funciona offline; aderente à Clean Architecture.
- ✅ Datas corretas em qualquer fuso (reusa a abstração existente).
- ⚠️ Agregação client-side percorre as tarefas/logs do usuário em memória —
  adequado ao volume atual; se crescer muito, considerar query por range de data
  (a coluna já é indexada).
