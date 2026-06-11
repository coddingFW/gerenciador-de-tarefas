import { describe, expect, it } from "vitest";
import { HistoryAggregator } from "../src/domain/services/HistoryAggregator.js";
import type { ExecutionLog, IsoDate } from "../src/domain/entities/index.js";

const log = (occurredOn: IsoDate, minutes = 0): ExecutionLog => ({
  userId: "u1",
  goalId: "g1",
  taskId: null,
  occurredOn,
  minutesSpent: minutes,
  source: "manual",
  clientEventId: `c-${occurredOn}-${minutes}-${Math.random()}`,
});

describe("HistoryAggregator.daily", () => {
  it("retorna exatamente `days` pontos terminando em today, em ordem crescente", () => {
    const series = HistoryAggregator.daily([], 7, "2026-06-11");
    expect(series).toHaveLength(7);
    expect(series[0]!.day).toBe("2026-06-05");
    expect(series.at(-1)!.day).toBe("2026-06-11");
  });

  it("preenche dias sem atividade com zero", () => {
    const series = HistoryAggregator.daily([log("2026-06-11", 10)], 7, "2026-06-11");
    expect(series.at(-1)).toEqual({ day: "2026-06-11", executions: 1, minutes: 10 });
    expect(series[0]).toEqual({ day: "2026-06-05", executions: 0, minutes: 0 });
  });

  it("soma execuções e minutos do mesmo dia", () => {
    const logs = [log("2026-06-10", 5), log("2026-06-10", 15), log("2026-06-11", 30)];
    const series = HistoryAggregator.daily(logs, 7, "2026-06-11");
    const d10 = series.find((p) => p.day === "2026-06-10")!;
    expect(d10).toEqual({ day: "2026-06-10", executions: 2, minutes: 20 });
  });

  it("ignora logs fora da janela", () => {
    const series = HistoryAggregator.daily([log("2026-05-01", 99)], 7, "2026-06-11");
    expect(series.reduce((s, p) => s + p.executions, 0)).toBe(0);
  });

  it("atravessa a virada de mês corretamente", () => {
    const series = HistoryAggregator.daily([log("2026-05-31", 7)], 30, "2026-06-11");
    expect(series.find((p) => p.day === "2026-05-31")?.minutes).toBe(7);
  });
});
