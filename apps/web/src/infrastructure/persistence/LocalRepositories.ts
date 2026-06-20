import type {
  Category,
  ExecutionLog,
  Goal,
  ICategoryRepository,
  IExecutionLogRepository,
  IGoalRepository,
  IProfileRepository,
  IReminderRepository,
  ITaskRepository,
  IsoDate,
  ProfileSnapshot,
  ProfileUpdate,
  Reminder,
  Task,
} from "@habit/core";
import {
  localDB,
  type StoredCategory,
  type StoredExecutionLog,
  type StoredGoal,
  type StoredProfile,
  type StoredReminder,
  type StoredTask,
} from "./db";

/**
 * Adapters local-first: o IndexedDB é a fonte da verdade do cliente (renderização
 * instantânea, offline). Toda escrita marca `_sync = 0` para o SyncEngine enviar
 * ao Supabase depois. Idempotência de logs por (userId, clientEventId).
 */

const stripGoal = ({ _sync, ...g }: StoredGoal): Goal => g;
const stripTask = ({ _sync, ...t }: StoredTask): Task => t;
const stripCategory = ({ _sync, ...c }: StoredCategory): Category => c;
const stripReminder = ({ _sync, ...r }: StoredReminder): Reminder => r;

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
      .filter((t) => t.status === "pending" && t.dueDate === date && !t.archivedAt)
      .toArray();
    return rows.map(stripTask);
  }
}

export class LocalCategoryRepository implements ICategoryRepository {
  async byId(id: string): Promise<Category | null> {
    const row = await localDB.categories.get(id);
    return row ? stripCategory(row) : null;
  }
  async save(category: Category): Promise<void> {
    await localDB.categories.put({ ...category, _sync: 0 });
  }
  async listFor(userId: string): Promise<Category[]> {
    const rows = await localDB.categories.where("userId").equals(userId).sortBy("sortOrder");
    return rows.map(stripCategory);
  }
}

export class LocalProfileRepository implements IProfileRepository {
  async getTimezone(userId: string): Promise<string | null> {
    const row = await localDB.profiles.get(userId);
    return row?.timezone ?? null;
  }
  async setTimezone(userId: string, timezone: string): Promise<void> {
    const cur = await localDB.profiles.get(userId);
    await localDB.profiles.put({ ...defaults(userId), ...cur, timezone, _sync: 0 });
  }
  async getProfile(userId: string): Promise<ProfileSnapshot | null> {
    const row = await localDB.profiles.get(userId);
    if (!row) return null;
    return { timezone: row.timezone, theme: row.theme, displayName: row.displayName, avatarUrl: row.avatarUrl };
  }
  async updateProfile(userId: string, patch: ProfileUpdate): Promise<void> {
    const cur = await localDB.profiles.get(userId);
    await localDB.profiles.put({ ...defaults(userId), ...cur, ...patch, _sync: 0 });
  }
}

/** Valores-base de um profile local recém-criado (antes de qualquer pull). */
function defaults(userId: string): StoredProfile {
  return { id: userId, timezone: "UTC", theme: "system", displayName: null, avatarUrl: null, _sync: 0 };
}

export class LocalReminderRepository implements IReminderRepository {
  async byId(id: string): Promise<Reminder | null> {
    const row = await localDB.reminders.get(id);
    return row ? stripReminder(row) : null;
  }
  async save(reminder: Reminder): Promise<void> {
    await localDB.reminders.put({ ...reminder, _sync: 0 });
  }
  async listForUser(userId: string): Promise<Reminder[]> {
    const rows = await localDB.reminders.where("userId").equals(userId).toArray();
    return rows.map(stripReminder);
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
