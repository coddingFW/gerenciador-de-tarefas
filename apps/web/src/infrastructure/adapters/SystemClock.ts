import type { IClock, IsoDate } from "@habit/core";

/** Relógio real. "Hoje" é resolvido no fuso do usuário (Fase 1: dia = fuso local). */
export class SystemClock implements IClock {
  today(timezone: string): IsoDate {
    // en-CA formata como YYYY-MM-DD; timeZone garante o dia correto por fuso.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  now(): Date {
    return new Date();
  }
}
