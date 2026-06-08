import type {
  ExecutionLog,
  Goal,
  IExecutionLogRepository,
  IGoalRepository,
  ITaskRepository,
  IsoDate,
  Task,
} from "@habit/core";
import { localDB, type StoredExecutionLog, type StoredGoal, type StoredTask } from "./db";

/**
 * Adapters local-first: o IndexedDB é a fonte da verdade do cliente (renderização
 * instantânea, offline). Toda escrita marca `_sync = 0` para o SyncEngine enviar
 * ao Supabase depois. Idempotência de logs por (userId, clientEventId).
 */

const stripGoal = ({ _sync, ...g }: StoredGoal): Goal => g;
const stripTask = ({ _sync, ...t }: StoredTask): Task => t;

export class LocalGoalRepository implements IGoalRepository {
  async byId(id: string): Promise<Goal | null> {
    const row = await localDB.goals.get(id);
    return row ? stripGoal(row) : null;
  }
  async save(goal: Goal): Promise<void> {
    await localDB.goals.put({ ...goal, _sync: 0 });
  }
}

export class LocalTaskRepository implements ITaskRepository {
  async byId(id: string): Promise<Task | null> {
    const row = await localDB.tasks.get(id);
    return row ? stripTask(row) : null;
  }
  async save(task: Task): Promise<void> {
    await localDB.tasks.put({ ...task, _sync: 0 });
  }
  async pendingFor(userId: string, date: IsoDate): Promise<Task[]> {
    const rows = await localDB.tasks
      .where("userId")
      .equals(userId)
      .filter((t) => t.status === "pending" && t.dueDate === date)
      .toArray();
    return rows.map(stripTask);
  }
}

export class LocalExecutionLogRepository implements IExecutionLogRepository {
  async append(log: ExecutionLog): Promise<void> {
    // Idempotência: ignora reenvios com o mesmo (userId, clientEventId).
    const existing = await localDB.executionLogs
      .where("[userId+clientEventId]")
      .equals([log.userId, log.clientEventId])
      .first();
    if (existing) return;

    const stored: StoredExecutionLog = { ...log, id: crypto.randomUUID(), _sync: 0 };
    await localDB.executionLogs.put(stored);
  }
  async forGoal(goalId: string): Promise<ExecutionLog[]> {
    const rows = await localDB.executionLogs.where("goalId").equals(goalId).toArray();
    return rows.map(({ _sync, id, ...l }) => l);
  }
}
