import type { Goal, GoalFrequency } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IEventBus, IGoalRepository } from "../ports/index.js";

export interface EditGoalInput {
  goalId: string;
  userId: string;
  /** Campos omitidos (undefined) ficam inalterados; `null` limpa o valor. */
  title?: string;
  frequency?: GoalFrequency;
  targetCount?: number;
  targetMinutes?: number | null;
  categoryId?: string | null;
  description?: string | null;
}

/**
 * US-02: editar um hábito. Aplica apenas os campos informados (patch parcial) e
 * revalida as mesmas invariantes de CreateGoal — defesa em profundidade junto
 * com os CHECK constraints do banco. A ownership é checada aqui (além da RLS).
 */
export class EditGoal {
  constructor(
    private readonly goals: IGoalRepository,
    private readonly bus: IEventBus,
  ) {}

  async execute(input: EditGoalInput): Promise<Goal> {
    const goal = await this.goals.byId(input.goalId);
    if (!goal || goal.userId !== input.userId) throw new Error("GOAL_NOT_FOUND");

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length === 0) throw new Error("GOAL_TITLE_REQUIRED");
      goal.title = title;
    }
    if (input.frequency !== undefined) goal.frequency = input.frequency;
    if (input.targetCount !== undefined) {
      if (input.targetCount <= 0) throw new Error("GOAL_TARGET_COUNT_INVALID");
      goal.targetCount = input.targetCount;
    }
    if (input.targetMinutes !== undefined) {
      if (input.targetMinutes != null && input.targetMinutes < 0) {
        throw new Error("GOAL_TARGET_MINUTES_INVALID");
      }
      goal.targetMinutes = input.targetMinutes;
    }
    if (input.categoryId !== undefined) goal.categoryId = input.categoryId;
    if (input.description !== undefined) goal.description = input.description;

    await this.goals.save(goal);
    await this.bus.publish(
      createEvent("GoalUpdated", goal.id, goal.userId, {
        frequency: goal.frequency,
        targetCount: goal.targetCount,
      }),
    );

    return goal;
  }
}
