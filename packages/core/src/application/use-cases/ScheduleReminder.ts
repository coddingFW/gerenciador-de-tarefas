import type { Reminder, Weekday } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IClock, IEventBus, IIdGenerator, IReminderRepository } from "../ports/index.js";

export interface ScheduleReminderInput {
  /** Se informado e existente, atualiza; senão cria um novo lembrete. */
  id?: string;
  userId: string;
  goalId: string;
  /** Horário local `HH:MM` (24h). */
  timeLocal: string;
  weekdays: Weekday[];
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Agenda (ou reagenda) um lembrete recorrente de um hábito. Recorrência simples:
 * um horário local + dias da semana. Valida formato e domínio — defesa em
 * profundidade junto às constraints do banco. Reativa o lembrete (active = true).
 */
export class ScheduleReminder {
  constructor(
    private readonly reminders: IReminderRepository,
    private readonly bus: IEventBus,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
  ) {}

  async execute(input: ScheduleReminderInput): Promise<Reminder> {
    if (!input.goalId) throw new Error("REMINDER_GOAL_REQUIRED");
    if (!TIME_RE.test(input.timeLocal)) throw new Error("REMINDER_TIME_INVALID");

    const weekdays = normalizeWeekdays(input.weekdays);
    if (weekdays.length === 0) throw new Error("REMINDER_WEEKDAYS_INVALID");

    const existing = input.id ? await this.reminders.byId(input.id) : null;
    if (existing && existing.userId !== input.userId) throw new Error("REMINDER_NOT_FOUND");

    const reminder: Reminder = existing
      ? { ...existing, timeLocal: input.timeLocal, weekdays, active: true }
      : {
          id: input.id ?? this.ids.uuid(),
          userId: input.userId,
          goalId: input.goalId,
          timeLocal: input.timeLocal,
          weekdays,
          active: true,
          createdAt: this.clock.now().toISOString(),
        };

    await this.reminders.save(reminder);
    await this.bus.publish(
      createEvent("ReminderScheduled", reminder.id, reminder.userId, {
        goalId: reminder.goalId,
        timeLocal: reminder.timeLocal,
        weekdays: reminder.weekdays,
      }),
    );
    return reminder;
  }
}

/** Valida o range (1..7), remove duplicatas e ordena. */
function normalizeWeekdays(input: Weekday[]): Weekday[] {
  const set = new Set<Weekday>();
  for (const d of input) {
    if (!Number.isInteger(d) || d < 1 || d > 7) throw new Error("REMINDER_WEEKDAYS_INVALID");
    set.add(d);
  }
  return [...set].sort((a, b) => a - b);
}
