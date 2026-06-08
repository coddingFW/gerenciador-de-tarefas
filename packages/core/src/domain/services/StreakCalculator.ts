import type { ExecutionLog, IsoDate } from "../entities/index.js";

export interface StreakResult {
  current: number;
  best: number;
  lastExecutionOn: IsoDate | null;
}

/**
 * Calcula streak atual e melhor SOMENTE a partir dos logs (autoritativo).
 * O cliente nunca escreve streak; este cálculo roda no servidor e é a fonte
 * da verdade exibida ao usuário (Fase 1 §5/§8).
 *
 * Implementação para frequência diária: dias consecutivos sem lacuna.
 * A streak "atual" só conta se o último dia com execução for hoje ou ontem.
 */
export class StreakCalculator {
  static computeDaily(logs: ExecutionLog[], today: IsoDate): StreakResult {
    const days = [...new Set(logs.map((l) => l.occurredOn))].sort();
    if (days.length === 0) {
      return { current: 0, best: 0, lastExecutionOn: null };
    }

    let best = 0;
    let run = 0;
    let prev: IsoDate | null = null;

    for (const day of days) {
      run = prev !== null && isNextDay(prev, day) ? run + 1 : 1;
      best = Math.max(best, run);
      prev = day;
    }

    const last = days[days.length - 1]!;
    const current = last === today || isNextDay(last, today) ? run : 0;

    return { current, best, lastExecutionOn: last };
  }
}

/** Verdadeiro quando `b` é exatamente o dia seguinte a `a` (UTC, ambos `YYYY-MM-DD`). */
function isNextDay(a: IsoDate, b: IsoDate): boolean {
  const diff = (toUtc(b) - toUtc(a)) / 86_400_000;
  return diff === 1;
}

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
}
