import { beforeEach, describe, expect, it } from "vitest";
import { ScheduleReminder } from "../src/application/use-cases/ScheduleReminder.js";
import type { Weekday } from "../src/domain/entities/index.js";
import { FakeClock, FakeEventBus, FakeIdGenerator, FakeReminderRepository } from "./fakes.js";

describe("ScheduleReminder", () => {
  let reminders: FakeReminderRepository;
  let bus: FakeEventBus;
  let useCase: ScheduleReminder;

  beforeEach(() => {
    reminders = new FakeReminderRepository();
    bus = new FakeEventBus();
    useCase = new ScheduleReminder(reminders, bus, new FakeClock(), new FakeIdGenerator());
  });

  it("cria um lembrete ativo e publica ReminderScheduled", async () => {
    const r = await useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "08:00", weekdays: [1, 3, 5] });
    expect(r.id).toBe("id-1");
    expect(r.active).toBe(true);
    expect(r.timeLocal).toBe("08:00");
    expect(r.weekdays).toEqual([1, 3, 5]);
    expect(bus.types()).toEqual(["ReminderScheduled"]);
  });

  it("ordena e remove dias duplicados", async () => {
    const r = await useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "09:30", weekdays: [5, 1, 1, 3] });
    expect(r.weekdays).toEqual([1, 3, 5]);
  });

  it("atualiza um lembrete existente (mesmo id) e reativa", async () => {
    const first = await useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "08:00", weekdays: [1] });
    const updated = await useCase.execute({
      id: first.id,
      userId: "u1",
      goalId: "g1",
      timeLocal: "20:00",
      weekdays: [6, 7],
    });
    expect(updated.id).toBe(first.id);
    expect(updated.timeLocal).toBe("20:00");
    expect(updated.weekdays).toEqual([6, 7]);
    expect(reminders.store.size).toBe(1);
  });

  it("rejeita horário em formato inválido", async () => {
    await expect(
      useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "8h", weekdays: [1] }),
    ).rejects.toThrow("REMINDER_TIME_INVALID");
    await expect(
      useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "24:00", weekdays: [1] }),
    ).rejects.toThrow("REMINDER_TIME_INVALID");
  });

  it("rejeita lista de dias vazia ou fora do range", async () => {
    await expect(
      useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "08:00", weekdays: [] }),
    ).rejects.toThrow("REMINDER_WEEKDAYS_INVALID");
    await expect(
      useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "08:00", weekdays: [0 as Weekday] }),
    ).rejects.toThrow("REMINDER_WEEKDAYS_INVALID");
    await expect(
      useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "08:00", weekdays: [8 as Weekday] }),
    ).rejects.toThrow("REMINDER_WEEKDAYS_INVALID");
  });

  it("rejeita goalId ausente", async () => {
    await expect(
      useCase.execute({ userId: "u1", goalId: "", timeLocal: "08:00", weekdays: [1] }),
    ).rejects.toThrow("REMINDER_GOAL_REQUIRED");
  });

  it("não deixa um usuário sobrescrever lembrete de outro", async () => {
    const r = await useCase.execute({ userId: "u1", goalId: "g1", timeLocal: "08:00", weekdays: [1] });
    await expect(
      useCase.execute({ id: r.id, userId: "u2", goalId: "g1", timeLocal: "09:00", weekdays: [2] }),
    ).rejects.toThrow("REMINDER_NOT_FOUND");
  });
});
