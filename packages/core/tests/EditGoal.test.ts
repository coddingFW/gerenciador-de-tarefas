import { beforeEach, describe, expect, it } from "vitest";
import { EditGoal } from "../src/application/use-cases/EditGoal.js";
import type { Goal } from "../src/domain/entities/index.js";
import { FakeEventBus, FakeGoalRepository } from "./fakes.js";

const seedGoal = (): Goal => ({
  id: "g1",
  userId: "u1",
  categoryId: null,
  title: "Ler",
  description: null,
  type: "habit",
  frequency: "daily",
  targetCount: 1,
  targetMinutes: null,
  active: true,
  archivedAt: null,
  createdAt: "2026-06-01T00:00:00.000Z",
});

describe("EditGoal", () => {
  let goals: FakeGoalRepository;
  let bus: FakeEventBus;
  let useCase: EditGoal;

  beforeEach(async () => {
    goals = new FakeGoalRepository();
    bus = new FakeEventBus();
    useCase = new EditGoal(goals, bus);
    await goals.save(seedGoal());
  });

  it("aplica patch parcial, faz trim e publica GoalUpdated", async () => {
    const goal = await useCase.execute({ goalId: "g1", userId: "u1", title: "  Meditar  " });
    expect(goal.title).toBe("Meditar");
    expect(goal.frequency).toBe("daily"); // inalterado
    expect(bus.types()).toEqual(["GoalUpdated"]);
  });

  it("atualiza frequência e meta de minutos", async () => {
    const goal = await useCase.execute({
      goalId: "g1",
      userId: "u1",
      frequency: "weekly",
      targetCount: 3,
      targetMinutes: 30,
    });
    expect(goal.frequency).toBe("weekly");
    expect(goal.targetCount).toBe(3);
    expect(goal.targetMinutes).toBe(30);
    expect(goal.title).toBe("Ler"); // inalterado
  });

  it("rejeita título vazio", async () => {
    await expect(useCase.execute({ goalId: "g1", userId: "u1", title: "   " })).rejects.toThrow(
      "GOAL_TITLE_REQUIRED",
    );
  });

  it("rejeita targetCount não positivo", async () => {
    await expect(useCase.execute({ goalId: "g1", userId: "u1", targetCount: 0 })).rejects.toThrow(
      "GOAL_TARGET_COUNT_INVALID",
    );
  });

  it("rejeita targetMinutes negativo", async () => {
    await expect(
      useCase.execute({ goalId: "g1", userId: "u1", targetMinutes: -1 }),
    ).rejects.toThrow("GOAL_TARGET_MINUTES_INVALID");
  });

  it("não deixa outro usuário editar (ownership)", async () => {
    await expect(useCase.execute({ goalId: "g1", userId: "intruso" })).rejects.toThrow(
      "GOAL_NOT_FOUND",
    );
  });
});
