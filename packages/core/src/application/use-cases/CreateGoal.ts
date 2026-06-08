import type { Goal, GoalFrequency } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IClock, IEventBus, IGoalRepository, IIdGenerator } from "../ports/index.js";

export interface CreateGoalInput {
  userId: string;
  title: string;
  frequency: GoalFrequency;
  targetCount: number;
  categoryId?: string | null;
  description?: string | null;
  targetMinutes?: number | null;
}

/**
 * US-02: criar um hábito. Valida invariantes de domínio antes de persistir
 * (defesa em profundidade junto com os CHECK constraints do banco).
 */
export class CreateGoal {
  constructor(
    private readonly goals: IGoalRepository,
    private readonly bus: IEventBus,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
  ) {}

  async execute(input: CreateGoalInput): Promise<Goal> {
    const title = input.title.trim();
    if (title.length === 0) throw new Error("GOAL_TITLE_REQUIRED");
    if (input.targetCount <= 0) throw new Error("GOAL_TARGET_COUNT_INVALID");
    if (input.targetMinutes != null && input.targetMinutes < 0) {
      throw new Error("GOAL_TARGET_MINUTES_INVALID");
    }

    const goal: Goal = {
      id: this.ids.uuid(),
      userId: input.userId,
      categoryId: input.categoryId ?? null,
      title,
      description: input.description ?? null,
      type: "habit",
      frequency: input.frequency,
      targetCount: input.targetCount,
      targetMinutes: input.targetMinutes ?? null,
      active: true,
      archivedAt: null,
      createdAt: this.clock.now().toISOString(),
    };

    await this.goals.save(goal);
    await this.bus.publish(
      createEvent("GoalCreated", goal.id, goal.userId, {
        frequency: goal.frequency,
        targetCount: goal.targetCount,
      }),
    );

    return goal;
  }
}
