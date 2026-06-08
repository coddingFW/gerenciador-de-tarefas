import { beforeEach, describe, expect, it } from "vitest";
import { LogExecution } from "../src/application/use-cases/LogExecution.js";
import type { Goal } from "../src/domain/entities/index.js";
import {
  FakeClock,
  FakeEventBus,
  FakeExecutionLogRepository,
  FakeGoalRepository,
} from "./fakes.js";

const makeGoal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1",
  userId: "u1",
  categoryId: null,
  title: "Meditar",
  description: null,
  type: "habit",
  frequency: "daily",
  targetCount: 1,
  targetMinutes: 10,
  active: true,
  archivedAt: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...over,
});

describe("LogExecution", () => {
  let goals: FakeGoalRepository;
  let logs: FakeExecutionLogRepository;
  let bus: FakeEventBus;
  let useCase: LogExecution;

  beforeEach(async () => {
    goals = new FakeGoalRepository();
    await goals.save(makeGoal());
    logs = new FakeExecutionLogRepository();
    bus = new FakeEventBus();
    useCase = new LogExecution(goals, logs, bus, new FakeClock());
  });

  it("registra o log do hábito e publica ExecutionLogged", async () => {
    await useCase.execute({
      goalId: "g1",
      userId: "u1",
      timezone: "America/Sao_Paulo",
      clientEventId: "evt-1",
      minutes: 12,
    });
    expect(logs.store).toHaveLength(1);
    expect(logs.store[0]).toMatchObject({ goalId: "g1", occurredOn: "2026-06-08", minutesSpent: 12 });
    expect(bus.types()).toEqual(["ExecutionLogged"]);
  });

  it("é idempotente por clientEventId", async () => {
    const input = { goalId: "g1", userId: "u1", timezone: "UTC", clientEventId: "dup" };
    await useCase.execute(input);
    await useCase.execute(input);
    expect(logs.store).toHaveLength(1);
  });

  it("rejeita goal inexistente", async () => {
    await expect(
      useCase.execute({ goalId: "nope", userId: "u1", timezone: "UTC", clientEventId: "e" }),
    ).rejects.toThrow("GOAL_NOT_FOUND");
  });

  it("rejeita goal de outro usuário", async () => {
    await expect(
      useCase.execute({ goalId: "g1", userId: "intruso", timezone: "UTC", clientEventId: "e" }),
    ).rejects.toThrow("GOAL_NOT_FOUND");
  });

  it("rejeita minutos negativos", async () => {
    await expect(
      useCase.execute({ goalId: "g1", userId: "u1", timezone: "UTC", clientEventId: "e", minutes: -3 }),
    ).rejects.toThrow("MINUTES_INVALID");
  });
});
