import { createEvent } from "../../domain/events/index.js";
import type {
  IClock,
  IEventBus,
  IExecutionLogRepository,
  IGoalRepository,
} from "../ports/index.js";

export interface LogExecutionInput {
  goalId: string;
  userId: string;
  timezone: string;
  /** UUID gerado offline — garante idempotência da sincronização. */
  clientEventId: string;
  minutes?: number;
}

/**
 * US-04: registrar a execução de um hábito diretamente contra o Goal (sem Task).
 * É o caminho do "registro sem fricção" da tela Today. Append-only e idempotente.
 */
export class LogExecution {
  constructor(
    private readonly goals: IGoalRepository,
    private readonly logs: IExecutionLogRepository,
    private readonly bus: IEventBus,
    private readonly clock: IClock,
  ) {}

  async execute(input: LogExecutionInput): Promise<void> {
    const goal = await this.goals.byId(input.goalId);
    if (!goal || goal.userId !== input.userId) throw new Error("GOAL_NOT_FOUND");

    const minutes = input.minutes ?? 0;
    if (minutes < 0) throw new Error("MINUTES_INVALID");

    await this.logs.append({
      userId: input.userId,
      goalId: goal.id,
      taskId: null,
      occurredOn: this.clock.today(input.timezone),
      minutesSpent: minutes,
      source: "manual",
      clientEventId: input.clientEventId,
    });

    await this.bus.publish(
      createEvent("ExecutionLogged", goal.id, input.userId, {
        goalId: goal.id,
        minutes,
      }),
    );
  }
}
