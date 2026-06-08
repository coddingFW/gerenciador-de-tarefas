import type { SupabaseClient } from "@supabase/supabase-js";
import { localDB } from "../persistence/db";

export interface SyncStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSyncAt: number | null;
  backend: boolean;
}

type Listener = (status: SyncStatus) => void;

/**
 * Motor de sincronização (Fase 1 §8.3). Drena os registros locais pendentes
 * (`_sync = 0`) para o Supabase quando há rede, marcando-os como sincronizados.
 * Idempotente: execution_logs usam upsert por (user_id, client_event_id).
 * Sem backend configurado, opera em modo local-only e nunca falha.
 */
export class SyncEngine {
  private running = false;
  private readonly listeners = new Set<Listener>();
  private status: SyncStatus;

  constructor(private readonly db: SupabaseClient | null) {
    this.status = {
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      pending: 0,
      syncing: false,
      lastSyncAt: null,
      backend: db !== null,
    };
  }

  start(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.patch({ online: true });
        void this.flush();
      });
      window.addEventListener("offline", () => this.patch({ online: false }));
    }
    void this.refreshPending();
    if (this.status.online) void this.flush();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  async flush(): Promise<void> {
    if (this.running || !this.db || !this.status.online) {
      await this.refreshPending();
      return;
    }
    this.running = true;
    this.patch({ syncing: true });
    try {
      await this.pushGoals();
      await this.pushExecutionLogs();
      await this.pushTasks();
      this.patch({ lastSyncAt: Date.now() });
    } catch {
      // Falha de rede: mantém pendentes e tenta no próximo evento 'online'.
    } finally {
      this.running = false;
      this.patch({ syncing: false });
      await this.refreshPending();
    }
  }

  private async pushGoals(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.goals.where("_sync").equals(0).toArray();
    for (const g of rows) {
      const { error } = await this.db.from("goals").upsert({
        id: g.id,
        user_id: g.userId,
        category_id: g.categoryId,
        title: g.title,
        description: g.description,
        type: g.type,
        frequency: g.frequency,
        target_count: g.targetCount,
        target_minutes: g.targetMinutes,
        active: g.active,
        archived_at: g.archivedAt,
      });
      if (error) throw error;
      await localDB.goals.update(g.id, { _sync: 1 });
    }
  }

  private async pushExecutionLogs(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.executionLogs.where("_sync").equals(0).toArray();
    for (const l of rows) {
      const { error } = await this.db.from("execution_logs").upsert(
        {
          user_id: l.userId,
          goal_id: l.goalId,
          task_id: l.taskId,
          occurred_on: l.occurredOn,
          minutes_spent: l.minutesSpent,
          source: l.source,
          client_event_id: l.clientEventId,
        },
        { onConflict: "user_id,client_event_id", ignoreDuplicates: true },
      );
      if (error) throw error;
      await localDB.executionLogs.update(l.id, { _sync: 1 });
    }
  }

  private async pushTasks(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.tasks.where("_sync").equals(0).toArray();
    for (const t of rows) {
      const { error } = await this.db.from("tasks").upsert({
        id: t.id,
        user_id: t.userId,
        goal_id: t.goalId,
        category_id: t.categoryId,
        title: t.title,
        due_date: t.dueDate,
        status: t.status,
        estimated_minutes: t.estimatedMinutes,
        completed_at: t.completedAt,
      });
      if (error) throw error;
      await localDB.tasks.update(t.id, { _sync: 1 });
    }
  }

  private async refreshPending(): Promise<void> {
    const [g, l, t] = await Promise.all([
      localDB.goals.where("_sync").equals(0).count(),
      localDB.executionLogs.where("_sync").equals(0).count(),
      localDB.tasks.where("_sync").equals(0).count(),
    ]);
    this.patch({ pending: g + l + t });
  }

  private patch(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    for (const listener of this.listeners) listener(this.status);
  }
}
