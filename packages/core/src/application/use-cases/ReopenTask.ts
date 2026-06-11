import type { Task } from "../../domain/entities/index.js";
import type { ITaskRepository } from "../ports/index.js";

export interface ReopenTaskInput {
  taskId: string;
  userId: string;
}

/**
 * Desfazer a conclusão de uma tarefa (US-03).
 *
 * DECISÃO DE DOMÍNIO (Opção 1): reverte apenas `status`/`completedAt`. O
 * `ExecutionLog` gravado na conclusão é IMUTÁVEL (append-only) e permanece —
 * correções de métrica, se necessárias, são feitas por log compensatório. Assim
 * o undo é simples e não viola a regra de imutabilidade dos fatos.
 */
export class ReopenTask {
  constructor(private readonly tasks: ITaskRepository) {}

  async execute(input: ReopenTaskInput): Promise<Task> {
    const task = await this.tasks.byId(input.taskId);
    if (!task || task.userId !== input.userId) throw new Error("TASK_NOT_FOUND");

    if (task.status === "done") {
      task.status = "pending";
      task.completedAt = null;
      await this.tasks.save(task);
    }
    return task;
  }
}
