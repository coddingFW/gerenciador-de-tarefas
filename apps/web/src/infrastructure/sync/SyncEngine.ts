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
      online:
        typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
          ? navigator.onLine
          : true,
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
    void this.bootstrap();
  }

  /**
   * Carga inicial: BAIXA o estado do servidor (restore após limpar o cache /
   * primeiro acesso em um novo dispositivo) e então ENVIA o que estiver pendente
   * localmente. Sem o pull, o cliente nunca recuperava dados — só empurrava.
   */
  private async bootstrap(): Promise<void> {
    await this.refreshPending();
    if (this.status.online) {
      await this.pull();
      await this.flush();
    }
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
      await this.pushProfiles();
      await this.pushCategories();
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

  /**
   * Sincronização de DESCIDA. A RLS já restringe cada SELECT ao próprio usuário.
   * Regra de merge (last-write-wins seguro): nunca sobrescreve um registro local
   * pendente (`_sync = 0`) — a edição local ainda não enviada vence e será
   * empurrada no flush; o resto é substituído pelo servidor e marcado `_sync = 1`.
   */
  async pull(): Promise<void> {
    if (!this.db || !this.status.online) return;
    this.patch({ syncing: true });
    try {
      await this.pullProfiles();
      await this.pullCategories();
      await this.pullGoals();
      await this.pullTasks();
      await this.pullExecutionLogs();
      this.patch({ lastSyncAt: Date.now() });
    } catch {
      // Rede instável: tenta de novo no próximo bootstrap/online.
    } finally {
      this.patch({ syncing: false });
      await this.refreshPending();
    }
  }

  private async pullProfiles(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("profiles").select("id, timezone");
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.timezone == null) continue;
      const local = await localDB.profiles.get(r.id);
      if (local && local._sync === 0) continue;
      await localDB.profiles.put({ id: r.id, timezone: r.timezone, _sync: 1 });
    }
  }

  private async pullCategories(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("categories").select("*");
    if (error) throw error;
    for (const r of data ?? []) {
      const local = await localDB.categories.get(r.id);
      if (local && local._sync === 0) continue;
      await localDB.categories.put({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        color: r.color,
        icon: r.icon,
        archived: r.archived,
        sortOrder: r.sort_order,
        _sync: 1,
      });
    }
  }

  private async pullGoals(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("goals").select("*");
    if (error) throw error;
    for (const r of data ?? []) {
      const local = await localDB.goals.get(r.id);
      if (local && local._sync === 0) continue;
      await localDB.goals.put({
        id: r.id,
        userId: r.user_id,
        categoryId: r.category_id,
        title: r.title,
        description: r.description,
        type: r.type,
        frequency: r.frequency,
        targetCount: r.target_count,
        targetMinutes: r.target_minutes,
        active: r.active,
        archivedAt: r.archived_at,
        createdAt: r.created_at,
        _sync: 1,
      });
    }
  }

  private async pullTasks(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("tasks").select("*");
    if (error) throw error;
    for (const r of data ?? []) {
      const local = await localDB.tasks.get(r.id);
      if (local && local._sync === 0) continue;
      await localDB.tasks.put({
        id: r.id,
        userId: r.user_id,
        goalId: r.goal_id,
        categoryId: r.category_id,
        title: r.title,
        dueDate: r.due_date,
        status: r.status,
        estimatedMinutes: r.estimated_minutes,
        completedAt: r.completed_at,
        _sync: 1,
      });
    }
  }

  /** Logs são imutáveis e idempotentes por (userId, clientEventId): se já existe
   *  localmente, nunca reescreve (evita duplicar com id de servidor diferente). */
  private async pullExecutionLogs(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("execution_logs").select("*");
    if (error) throw error;
    for (const r of data ?? []) {
      const existing = await localDB.executionLogs
        .where("[userId+clientEventId]")
        .equals([r.user_id, r.client_event_id])
        .first();
      if (existing) continue;
      await localDB.executionLogs.put({
        id: r.id,
        userId: r.user_id,
        goalId: r.goal_id,
        taskId: r.task_id,
        occurredOn: r.occurred_on,
        minutesSpent: r.minutes_spent,
        source: r.source,
        clientEventId: r.client_event_id,
        _sync: 1,
      });
    }
  }

  /** Timezone do usuário → profiles (linha já criada pelo trigger handle_new_user). */
  private async pushProfiles(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.profiles.where("_sync").equals(0).toArray();
    for (const p of rows) {
      const { error } = await this.db.from("profiles").update({ timezone: p.timezone }).eq("id", p.id);
      if (error) throw error;
      await localDB.profiles.update(p.id, { _sync: 1 });
    }
  }

  private async pushCategories(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.categories.where("_sync").equals(0).toArray();
    for (const c of rows) {
      const { error } = await this.db.from("categories").upsert({
        id: c.id,
        user_id: c.userId,
        name: c.name,
        color: c.color,
        icon: c.icon,
        archived: c.archived,
        sort_order: c.sortOrder,
      });
      if (error) throw error;
      await localDB.categories.update(c.id, { _sync: 1 });
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
    const [g, l, t, c, p] = await Promise.all([
      localDB.goals.where("_sync").equals(0).count(),
      localDB.executionLogs.where("_sync").equals(0).count(),
      localDB.tasks.where("_sync").equals(0).count(),
      localDB.categories.where("_sync").equals(0).count(),
      localDB.profiles.where("_sync").equals(0).count(),
    ]);
    this.patch({ pending: g + l + t + c + p });
  }

  private patch(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    for (const listener of this.listeners) listener(this.status);
  }
}
