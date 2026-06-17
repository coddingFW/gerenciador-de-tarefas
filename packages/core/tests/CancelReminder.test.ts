import { beforeEach, describe, expect, it } from "vitest";
import { CancelReminder } from "../src/application/use-cases/CancelReminder.js";
import type { Reminder } from "../src/domain/entities/index.js";
import { FakeEventBus, FakeReminderRepository } from "./fakes.js";

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: "r1",
  userId: "u1",
  goalId: "g1",
  timeLocal: "08:00",
  weekdays: [1, 2, 3, 4, 5],
  active: true,
  createdAt: "2026-06-08T12:00:00.000Z",
  ...over,
});

describe("CancelReminder", () => {
  let reminders: FakeReminderRepository;
  let bus: FakeEventBus;
  let useCase: CancelReminder;

  beforeEach(() => {
    reminders = new FakeReminderRepository([reminder()]);
    bus = new FakeEventBus();
    useCase = new CancelReminder(reminders, bus);
  });

  it("desativa o lembrete e publica ReminderCancelled", async () => {
    const r = await useCase.execute({ reminderId: "r1", userId: "u1" });
    expect(r.active).toBe(false);
    expect(bus.types()).toEqual(["ReminderCancelled"]);
  });

  it("é idempotente: já inativo não republica evento", async () => {
    reminders.store.set("r1", reminder({ active: false }));
    const r = await useCase.execute({ reminderId: "r1", userId: "u1" });
    expect(r.active).toBe(false);
    expect(bus.types()).toEqual([]);
  });

  it("rejeita lembrete inexistente", async () => {
    await expect(useCase.execute({ reminderId: "nope", userId: "u1" })).rejects.toThrow(
      "REMINDER_NOT_FOUND",
    );
  });

  it("rejeita cancelar lembrete de outro usuário", async () => {
    await expect(useCase.execute({ reminderId: "r1", userId: "u2" })).rejects.toThrow(
      "REMINDER_NOT_FOUND",
    );
  });
});
