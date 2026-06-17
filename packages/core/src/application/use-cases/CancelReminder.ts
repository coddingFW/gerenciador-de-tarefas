import type { Reminder } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IEventBus, IReminderRepository } from "../ports/index.js";

export interface CancelReminderInput {
  reminderId: string;
  userId: string;
}

/**
 * Desativa um lembrete (soft: `active = false`). O registro permanece para sync
 * idempotente entre dispositivos; reativar é só reagendar (`ScheduleReminder`).
 */
export class CancelReminder {
  constructor(
    private readonly reminders: IReminderRepository,
    private readonly bus: IEventBus,
  ) {}

  async execute(input: CancelReminderInput): Promise<Reminder> {
    const reminder = await this.reminders.byId(input.reminderId);
    if (!reminder || reminder.userId !== input.userId) throw new Error("REMINDER_NOT_FOUND");
    if (!reminder.active) return reminder;

    const updated: Reminder = { ...reminder, active: false };
    await this.reminders.save(updated);
    await this.bus.publish(
      createEvent("ReminderCancelled", updated.id, updated.userId, { goalId: updated.goalId }),
    );
    return updated;
  }
}
