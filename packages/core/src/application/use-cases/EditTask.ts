import type { IsoDate, Task } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IEventBus, ITaskRepository } from "../ports/index.js";

export interface EditTaskInput {
  taskId: string;
  userId: string;
  title?: string;
  /** Nova data (no fuso do usuário) ou `null` para "sem data". */
  dueDate?: IsoDate | null;
  estimatedMinutes?: number | null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Edita uma tarefa avulsa — título, data (remarcar) e/ou minutos. Regra de
 * domínio (não pode viver na UI): valida título e formato de data; só aplica os
 * campos informados. Publica `TaskUpdated`. Persistência offline-first via repo.
 */
export class EditTask {
  constructor(
    private readonly tasks: ITaskRepository,
    private readonly bus: IEventBus,
  ) {}

  async execute(input: EditTaskInput): Promise<Task> {
    const task = await this.tasks.byId(input.taskId);
    if (!task || task.userId !== input.userId) throw new Error("TASK_NOT_FOUND");

    const patch: Partial<Task> = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length === 0) throw new Error("TASK_TITLE_REQUIRED");
      patch.title = title;
    }
    if (input.dueDate !== undefined) {
      if (input.dueDate !== null && !ISO_DATE_RE.test(input.dueDate)) {
        throw new Error("TASK_DUE_DATE_INVALID");
      }
      patch.dueDate = input.dueDate;
    }
    if (input.estimatedMinutes !== undefined) {
      if (input.estimatedMinutes !== null && input.estimatedMinutes < 0) {
        throw new Error("TASK_MINUTES_INVALID");
      }
      patch.estimatedMinutes = input.estimatedMinutes;
    }
    if (Object.keys(patch).length === 0) return task;

    const updated: Task = { ...task, ...patch };
    await this.tasks.save(updated);
    await this.bus.publish(createEvent("TaskUpdated", updated.id, updated.userId, { ...patch }));
    return updated;
  }
}
