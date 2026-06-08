import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  ProductivityScore,
  type ScoreInput,
} from "../src/domain/services/ProductivityScore.js";

const base: ScoreInput = {
  completionRate: 0,
  adherence: 0,
  minutesSpent: 0,
  targetMinutes: null,
  streakCount: 0,
};

describe("ProductivityScore.compute", () => {
  it("retorna 0 para entrada totalmente zerada", () => {
    expect(ProductivityScore.compute(base)).toBe(0);
  });

  it("retorna 100 quando tudo está no máximo", () => {
    const input: ScoreInput = {
      completionRate: 1,
      adherence: 1,
      minutesSpent: 60,
      targetMinutes: 60,
      streakCount: 1000, // bônus satura ~1
    };
    expect(ProductivityScore.compute(input)).toBe(100);
  });

  it("satura a razão de tempo em 1 mesmo passando da meta", () => {
    const a = ProductivityScore.compute({ ...base, minutesSpent: 60, targetMinutes: 60 });
    const b = ProductivityScore.compute({ ...base, minutesSpent: 600, targetMinutes: 60 });
    expect(a).toBe(b);
  });

  it("sem meta de minutos, qualquer tempo > 0 conta como cheio", () => {
    const withTime = ProductivityScore.compute({ ...base, minutesSpent: 5, targetMinutes: null });
    const noTime = ProductivityScore.compute({ ...base, minutesSpent: 0, targetMinutes: null });
    expect(withTime).toBeGreaterThan(noTime);
  });

  it("trata NaN como 0 (robustez de borda)", () => {
    expect(ProductivityScore.compute({ ...base, completionRate: NaN })).toBe(0);
  });

  it("faz clamp de valores acima de 1", () => {
    const clamped = ProductivityScore.compute({ ...base, completionRate: 5 });
    const exact = ProductivityScore.compute({ ...base, completionRate: 1 });
    expect(clamped).toBe(exact);
  });

  it("respeita pesos customizados", () => {
    const onlyCompletion = { completion: 1, adherence: 0, time: 0, streak: 0 };
    const score = ProductivityScore.compute({ ...base, completionRate: 0.5 }, onlyCompletion);
    expect(score).toBe(50);
  });

  it("evita divisão por zero quando todos os pesos são 0", () => {
    const zero = { completion: 0, adherence: 0, time: 0, streak: 0 };
    expect(ProductivityScore.compute({ ...base, completionRate: 1 }, zero)).toBe(0);
  });

  it("os pesos padrão somam 1", () => {
    const sum =
      DEFAULT_WEIGHTS.completion +
      DEFAULT_WEIGHTS.adherence +
      DEFAULT_WEIGHTS.time +
      DEFAULT_WEIGHTS.streak;
    expect(sum).toBeCloseTo(1);
  });
});
