import type { ExecutionLog, IsoDate } from "../entities/index.js";

export interface HistoryPoint {
  day: IsoDate;
  executions: number;
  minutes: number;
}

/**
 * Agrega execuções em uma série temporal diária (volume + tempo) para o
 * dashboard histórico (7/30 dias). PURO e determinístico — calcula só a partir
 * dos `ExecutionLog`, sem infra. A janela termina em `today` (fuso do usuário) e
 * é preenchida com zeros para dias sem atividade, garantindo um eixo contínuo.
 */
export class HistoryAggregator {
  static daily(logs: ExecutionLog[], days: number, today: IsoDate): HistoryPoint[] {
    const totals = new Map<IsoDate, { executions: number; minutes: number }>();
    for (const log of logs) {
      const acc = totals.get(log.occurredOn) ?? { executions: 0, minutes: 0 };
      acc.executions += 1;
      acc.minutes += log.minutesSpent;
      totals.set(log.occurredOn, acc);
    }

    const series: HistoryPoint[] = [];
    for (let offset = days - 1; offset >= 0; offset--) {
      const day = addDays(today, -offset);
      const acc = totals.get(day);
      series.push({ day, executions: acc?.executions ?? 0, minutes: acc?.minutes ?? 0 });
    }
    return series;
  }
}

/** Soma `delta` dias a uma data ISO `YYYY-MM-DD` em UTC (evita drift de fuso). */
function addDays(date: IsoDate, delta: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  const ms = Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
