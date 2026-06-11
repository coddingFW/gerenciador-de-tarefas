import { beforeEach, describe, expect, it } from "vitest";
import { ArchiveGoal } from "../src/application/use-cases/ArchiveGoal.js";
import type { Goal } from "../src/domain/entities/index.js";
import { FakeClock, FakeEventBus, FakeGoalRepository } from "./fakes.js";

const seedGoal = (over: Partial<Goal> = {}): Goal => ({
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
  ...over,
});

describe("ArchiveGoal", () => {
  let goals: FakeGoalRepository;
  let bus: FakeEventBus;
  let useCase: ArchiveGoal;

  beforeEach(() => {
    goals = new FakeGoalRepository();
    bus = new FakeEventBus();
    useCase = new ArchiveGoal(goals, bus, new FakeClock());
  });

  it("arquiva: desativa, carimba archivedAt e publica GoalArchived", async () => {
    await goals.save(seedGoal());
    const goal = await useCase.execute({ goalId: "g1", userId: "u1" });
    expect(goal.active).toBe(false);
    expect(goal.archivedAt).toBe("2026-06-08T12:00:00.000Z");
    expect(bus.types()).toEqual(["GoalArchived"]);
  });

  it("restaura: reativa e limpa archivedAt", async () => {
    await goals.save(seedGoal({ active: false, archivedAt: "2026-06-05T00:00:00.000Z" }));
    const goal = await useCase.execute({ goalId: "g1", userId: "u1", archived: false });
    expect(goal.active).toBe(true);
    expect(goal.archivedAt).toBeNull();
  });

  it("não deixa outro usuário arquivar (ownership)", async () => {
    await goals.save(seedGoal());
    await expect(useCase.execute({ goalId: "g1", userId: "intruso" })).rejects.toThrow(
      "GOAL_NOT_FOUND",
    );
  });
});
