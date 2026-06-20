import type { IsoDate, Task } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IEventBus, IIdGenerator, ITaskRepository } from "../ports/index.js";

export interface CreateTaskInput {
  userId: string;
  title: string;
  dueDate?: IsoDate | null;
  estimatedMinutes?: number | null;
  categoryId?: string | null;
}

/**
 * US-03: criar uma tarefa AVULSA (one-off, `goalId = null`). Diferente do hábito
 * recorrente: tem `dueDate` e ciclo de vida pending → done (com undo via
 * ReopenTask). Valida título e minutos.
 */
export class CreateTask {
  constructor(
    private readonly tasks: ITaskRepository,
    private readonly bus: IEventBus,
    private readonly ids: IIdGenerator,
  ) {}

  async execute(input: CreateTaskInput): Promise<Task> {
    const title = input.title.trim();
    if (title.length === 0) throw new Error("TASK_TITLE_REQUIRED");
    if (input.estimatedMinutes != null && input.estimatedMinutes < 0) {
      throw new Error("TASK_MINUTES_INVALID");
    }

    const task: Task = {
      id: this.ids.uuid(),
      userId: input.userId,
      goalId: null,
      categoryId: input.categoryId ?? null,
      title,
      dueDate: input.dueDate ?? null,
      status: "pending",
      estimatedMinutes: input.estimatedMinutes ?? null,
      completedAt: null,
      archivedAt: null,
    };

    await this.tasks.save(task);
    await this.bus.publish(createEvent("TaskCreated", task.id, task.userId, { dueDate: task.dueDate }));
    return task;
  }
}
