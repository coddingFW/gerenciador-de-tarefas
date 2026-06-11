import { describe, expect, it } from "vitest";
import { StreakCalculator } from "../src/domain/services/StreakCalculator.js";
import type { ExecutionLog, IsoDate } from "../src/domain/entities/index.js";

const log = (occurredOn: IsoDate): ExecutionLog => ({
  userId: "u1",
  goalId: "g1",
  taskId: null,
  occurredOn,
  minutesSpent: 0,
  source: "manual",
  clientEventId: `c-${occurredOn}`,
});

describe("StreakCalculator.computeDaily", () => {
  it("retorna zero quando não há logs", () => {
    expect(StreakCalculator.computeDaily([], "2026-06-08")).toEqual({
      current: 0,
      best: 0,
      lastExecutionOn: null,
    });
  });

  it("conta dias consecutivos terminando hoje", () => {
    const logs = ["2026-06-06", "2026-06-07", "2026-06-08"].map(log);
    expect(StreakCalculator.computeDaily(logs, "2026-06-08")).toEqual({
      current: 3,
      best: 3,
      lastExecutionOn: "2026-06-08",
    });
  });

  it("mantém a streak atual quando o último dia foi ontem", () => {
    const logs = ["2026-06-06", "2026-06-07"].map(log);
    expect(StreakCalculator.computeDaily(logs, "2026-06-08")).toMatchObject({
      current: 2,
      best: 2,
    });
  });

  it("zera a streak atual após uma lacuna, mas preserva o melhor", () => {
    const logs = ["2026-06-01", "2026-06-02", "2026-06-05"].map(log);
    expect(StreakCalculator.computeDaily(logs, "2026-06-10")).toMatchObject({
      current: 0,
      best: 2,
    });
  });

  it("deduplica múltiplos logs no mesmo dia", () => {
    const logs = [log("2026-06-07"), log("2026-06-07"), log("2026-06-08")];
    expect(StreakCalculator.computeDaily(logs, "2026-06-08").current).toBe(2);
  });

  it("atravessa corretamente a virada de mês", () => {
    const logs = ["2026-05-31", "2026-06-01"].map(log);
    expect(StreakCalculator.computeDaily(logs, "2026-06-01").best).toBe(2);
  });

  // Virada de dia (QA de timezone): o `today` correto vem do IClock no fuso do
  // usuário; aqui validamos a semântica de fronteira que ele alimenta.
  it("às 23:59 (hoje = dia da execução) a streak conta o dia atual", () => {
    const logs = ["2026-06-09", "2026-06-10"].map(log);
    // 23:59 de 10/06 → today = 2026-06-10
    expect(StreakCalculator.computeDaily(logs, "2026-06-10").current).toBe(2);
  });

  it("às 00:01 do dia seguinte (última execução = ontem) a streak se mantém", () => {
    const logs = ["2026-06-09", "2026-06-10"].map(log);
    // 00:01 de 11/06 → today = 2026-06-11, última = ontem
    expect(StreakCalculator.computeDaily(logs, "2026-06-11").current).toBe(2);
  });

  it("após pular um dia inteiro, a virada quebra a streak atual", () => {
    const logs = ["2026-06-09", "2026-06-10"].map(log);
    // 00:01 de 12/06 → today = 2026-06-12, última = anteontem
    expect(StreakCalculator.computeDaily(logs, "2026-06-12").current).toBe(0);
  });
});
