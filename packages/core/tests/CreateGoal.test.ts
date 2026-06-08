import { beforeEach, describe, expect, it } from "vitest";
import { CreateGoal } from "../src/application/use-cases/CreateGoal.js";
import {
  FakeClock,
  FakeEventBus,
  FakeGoalRepository,
  FakeIdGenerator,
} from "./fakes.js";

describe("CreateGoal", () => {
  let goals: FakeGoalRepository;
  let bus: FakeEventBus;
  let useCase: CreateGoal;

  beforeEach(() => {
    goals = new FakeGoalRepository();
    bus = new FakeEventBus();
    useCase = new CreateGoal(goals, bus, new FakeClock(), new FakeIdGenerator());
  });

  it("cria o hábito, persiste e publica GoalCreated", async () => {
    const goal = await useCase.execute({
      userId: "u1",
      title: "  Ler 10 páginas  ",
      frequency: "daily",
      targetCount: 1,
    });

    expect(goal.title).toBe("Ler 10 páginas"); // trim aplicado
    expect(goal.active).toBe(true);
    expect(await goals.byId(goal.id)).not.toBeNull();
    expect(bus.types()).toEqual(["GoalCreated"]);
  });

  it("rejeita título vazio", async () => {
    await expect(
      useCase.execute({ userId: "u1", title: "   ", frequency: "daily", targetCount: 1 }),
    ).rejects.toThrow("GOAL_TITLE_REQUIRED");
  });

  it("rejeita targetCount não positivo", async () => {
    await expect(
      useCase.execute({ userId: "u1", title: "x", frequency: "weekly", targetCount: 0 }),
    ).rejects.toThrow("GOAL_TARGET_COUNT_INVALID");
  });

  it("rejeita targetMinutes negativo", async () => {
    await expect(
      useCase.execute({
        userId: "u1",
        title: "x",
        frequency: "daily",
        targetCount: 1,
        targetMinutes: -5,
      }),
    ).rejects.toThrow("GOAL_TARGET_MINUTES_INVALID");
  });
});
