import type { IsoDate } from "@habit/core";

/**
 * Aritmética de calendário para montar a grade — independente de fuso (apenas
 * layout: quantos dias o mês tem, em que dia da semana começa). O "hoje" e
 * comparações de data vêm do domínio (`container.clock.today(timezone)`), nunca
 * daqui. Usamos UTC só para evitar drift de horário de verão no cálculo do grid.
 */
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Cabeçalho com a semana começando no domingo. */
export const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");

export function iso(y: number, m: number, d: number): IsoDate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseIso(value: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = value.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dia da semana (0=domingo) do primeiro dia do mês. */
export function firstWeekday(y: number, m: number): number {
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

export function monthLabel(y: number, m: number): string {
  return `${MONTHS[m - 1]} ${y}`;
}

/** Soma `n` dias a uma IsoDate (UTC para não pegar DST). */
export function addDays(value: IsoDate, n: number): IsoDate {
  const { y, m, d } = parseIso(value);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = (m - 1) + delta;
  return { y: y + Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 + 1 };
}

/** Formato amigável "19 de junho". */
export function dayLabel(value: IsoDate): string {
  const { m, d } = parseIso(value);
  return `${d} de ${MONTHS[m - 1]!.toLowerCase()}`;
}
