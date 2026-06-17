# ADR-0005 — Match temporal dos lembretes: janela + idempotência no fuso

- **Status:** Aceito
- **Data:** 2026-06-16
- **Fase:** 2 (Lembretes)

## Contexto
Os lembretes têm um horário local (`HH:MM`) + dias da semana, no fuso do usuário
(`profiles.timezone`). Um cron a cada minuto precisa decidir, em UTC, quais
lembretes disparar agora — sem duplicar e sem perder.

## Problema
1. Cruzar `time_local` (fuso do usuário) com o `now()` (UTC) corretamente.
2. Não disparar duas vezes (execuções sobrepostas do cron, retries).
3. Não **perder** um disparo se o cron atrasar/pular um minuto.

## Alternativas
1. **Igualdade exata** `HH:MM == now` no fuso — simples, mas **perde** o lembrete
   se o minuto exato não for processado; e exige idempotência à parte.
2. **Janela + idempotência por data no fuso (escolhida)** — dispara se o horário
   alvo de hoje (no fuso) ocorreu dentro dos últimos N minutos, e ainda não foi
   enviado hoje (data avaliada **no fuso do usuário**).

## Decisão
Adotar **(2)** na função SQL `claim_due_reminders(p_now, p_window_minutes=5)`:
- `local_now := p_now AT TIME ZONE profiles.timezone`
- alvo `:= local_now::date + time_local`; dispara se `alvo <= local_now` e
  `alvo > local_now - window` e `isodow(local_now) ∈ weekdays`;
- idempotência: `last_sent_on IS DISTINCT FROM local_now::date`.
- A função faz `UPDATE ... RETURNING` (seleciona **e** marca atomicamente),
  evitando disparo duplo entre execuções concorrentes. `SECURITY DEFINER`,
  exposta só ao `service_role`.

## Consequências
- ✅ Nunca duplica (idempotência + claim atômico) e tolera execuções perdidas
  (janela). Correto na virada da meia-noite (data no fuso).
- ⚠️ Um atraso maior que a janela (`> N min`) ainda pode perder um disparo —
  aceitável com cron de 1 min e janela de 5 min.
- ⚠️ `last_sent_on` é uma data: um hábito dispara no máximo 1×/dia (coerente com
  a recorrência simples desta fase).
