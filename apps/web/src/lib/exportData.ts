import { localDB } from "../infrastructure/persistence/db";

function strip<T extends { _sync?: unknown }>(rows: T[]): Array<Omit<T, "_sync">> {
  return rows.map(({ _sync, ...rest }) => rest as Omit<T, "_sync">);
}

/**
 * Exporta TODOS os dados do usuário num único JSON (LGPD — portabilidade).
 * Lê do Dexie (fonte da verdade do cliente) — offline-first, sem servidor.
 * Remove o campo interno `_sync`.
 */
export async function exportUserDataJson(userId: string): Promise<void> {
  const [goals, tasks, categories, executionLogs, reminders, profile] = await Promise.all([
    localDB.goals.where("userId").equals(userId).toArray(),
    localDB.tasks.where("userId").equals(userId).toArray(),
    localDB.categories.where("userId").equals(userId).toArray(),
    localDB.executionLogs.where("userId").equals(userId).toArray(),
    localDB.reminders.where("userId").equals(userId).toArray(),
    localDB.profiles.get(userId),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    profile: profile ? strip([profile])[0] : null,
    categories: strip(categories),
    goals: strip(goals),
    tasks: strip(tasks),
    reminders: strip(reminders),
    executionLogs: strip(executionLogs),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `habit-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
