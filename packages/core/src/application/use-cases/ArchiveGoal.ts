import type { Goal } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IClock, IEventBus, IGoalRepository } from "../ports/index.js";

export interface ArchiveGoalInput {
  goalId: string;
  userId: string;
  /** `false` restaura um hábito arquivado. Padrão: `true` (arquiva). */
  archived?: boolean;
}

/**
 * US-02: arquivar (ou restaurar) um hábito. "Excluir" é modelado como
 * arquivamento (soft delete): preserva o histórico imutável de execuções e
 * evita tombstones de sincronização. `active`/`archivedAt` já existem na
 * entidade e no schema.
 */
export class ArchiveGoal {
  constructor(
    private readonly goals: IGoalRepository,
    private readonly bus: IEventBus,
    private readonly clock: IClock,
  ) {}

  async execute(input: ArchiveGoalInput): Promise<Goal> {
    const goal = await this.goals.byId(input.goalId);
    if (!goal || goal.userId !== input.userId) throw new Error("GOAL_NOT_FOUND");

    const archived = input.archived ?? true;
    goal.active = !archived;
    goal.archivedAt = archived ? this.clock.now().toISOString() : null;

    await this.goals.save(goal);
    await this.bus.publish(createEvent("GoalArchived", goal.id, goal.userId, { archived }));

    return goal;
  }
}
