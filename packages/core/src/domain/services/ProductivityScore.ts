/**
 * Score de produtividade (Fase 1 §5.1). Função PURA e determinística — é o
 * exemplo canônico de cálculo validado por testes antes de chegar ao usuário.
 *
 *   score = w1 * taxaConclusão
 *         + w2 * aderência
 *         + w3 * razãoTempo (saturada)
 *         + w4 * bônusStreak (saturado)
 *
 * Resultado normalizado em 0..100.
 */

export interface ScoreWeights {
  completion: number;
  adherence: number;
  time: number;
  streak: number;
}

export interface ScoreInput {
  /** Tarefas concluídas / planejadas no período (0..1). */
  completionRate: number;
  /** Metas do período cumpridas / definidas (0..1). */
  adherence: number;
  minutesSpent: number;
  targetMinutes: number | null;
  streakCount: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  completion: 0.4,
  adherence: 0.3,
  time: 0.2,
  streak: 0.1,
};

export class ProductivityScore {
  static compute(input: ScoreInput, weights: ScoreWeights = DEFAULT_WEIGHTS): number {
    const completion = clamp01(input.completionRate);
    const adherence = clamp01(input.adherence);
    const time = timeRatio(input.minutesSpent, input.targetMinutes);
    const streak = streakBonus(input.streakCount);

    const raw =
      weights.completion * completion +
      weights.adherence * adherence +
      weights.time * time +
      weights.streak * streak;

    const total = weights.completion + weights.adherence + weights.time + weights.streak;
    const normalized = total > 0 ? raw / total : 0;

    return Math.round(clamp01(normalized) * 100);
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function timeRatio(minutesSpent: number, targetMinutes: number | null): number {
  if (targetMinutes === null || targetMinutes <= 0) {
    return minutesSpent > 0 ? 1 : 0;
  }
  return clamp01(minutesSpent / targetMinutes);
}

/** Satura suavemente em direção a 1 conforme a streak cresce (meia-vida ~7 dias). */
function streakBonus(streakCount: number): number {
  if (streakCount <= 0) return 0;
  return 1 - Math.exp(-streakCount / 7);
}
