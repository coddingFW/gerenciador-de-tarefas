import type { Task } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IClock, IEventBus, ITaskRepository } from "../ports/index.js";

export interface ArchiveTaskInput {
  taskId: string;
  userId: string;
}

/**
 * Exclui (soft delete) uma tarefa avulsa: marca `archivedAt`. A tarefa some das
 * listas, mas o registro permanece — sync robusto (não "ressuscita" no pull) e
 * preserva os logs imutáveis de tarefas já concluídas. Idempotente.
 */
export class ArchiveTask {
  constructor(
    private readonly tasks: ITaskRepository,
    private readonly bus: IEventBus,
    private readonly clock: IClock,
  ) {}

  async execute(input: ArchiveTaskInput): Promise<Task> {
    const task = await this.tasks.byId(input.taskId);
    if (!task || task.userId !== input.userId) throw new Error("TASK_NOT_FOUND");
    if (task.archivedAt) return task;

    const updated: Task = { ...task, archivedAt: this.clock.now().toISOString() };
    await this.tasks.save(updated);
    await this.bus.publish(createEvent("TaskArchived", updated.id, updated.userId, {}));
    return updated;
  }
}
