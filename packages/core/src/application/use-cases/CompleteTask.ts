import { createEvent } from "../../domain/events/index.js";
import type {
  IClock,
  IEventBus,
  IExecutionLogRepository,
  ITaskRepository,
} from "../ports/index.js";

export interface CompleteTaskInput {
  taskId: string;
  userId: string;
  timezone: string;
  /** UUID gerado offline — garante idempotência da sincronização. */
  clientEventId: string;
  minutes?: number;
}

/**
 * US-03/US-04: concluir uma tarefa/hábito. Registra um ExecutionLog imutável
 * e publica os eventos de domínio. A ownership é checada aqui como defesa extra
 * além da RLS do banco (Fase 1 §7.3).
 */
export class CompleteTask {
  constructor(
    private readonly tasks: ITaskRepository,
    private readonly logs: IExecutionLogRepository,
    private readonly bus: IEventBus,
    private readonly clock: IClock,
  ) {}

  async execute(input: CompleteTaskInput): Promise<void> {
    const task = await this.tasks.byId(input.taskId);
    if (!task || task.userId !== input.userId) throw new Error("TASK_NOT_FOUND");

    const minutes = input.minutes ?? 0;
    if (minutes < 0) throw new Error("MINUTES_INVALID");

    if (task.status !== "done") {
      task.status = "done";
      task.completedAt = this.clock.now().toISOString();
      await this.tasks.save(task);
    }

    await this.logs.append({
      userId: input.userId,
      goalId: task.goalId,
      taskId: task.id,
      occurredOn: this.clock.today(input.timezone),
      minutesSpent: minutes,
      source: "manual",
      clientEventId: input.clientEventId,
    });

    await this.bus.publish(
      createEvent("TaskCompleted", task.id, input.userId, { goalId: task.goalId }),
    );
    await this.bus.publish(
      createEvent("ExecutionLogged", task.id, input.userId, {
        goalId: task.goalId,
        minutes,
      }),
    );
  }
}
