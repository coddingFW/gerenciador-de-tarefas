import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Table } from "dexie";
import type { ExecutionSource, GoalFrequency, TaskStatus, Theme, Weekday } from "@habit/core";
import { localDB, type SyncState } from "../persistence/db";

export interface SyncStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSyncAt: number | null;
  backend: boolean;
}

type Listener = (status: SyncStatus) => void;

// Linhas como o Postgres/Supabase as devolve (snake_case), tanto no pull quanto
// nos eventos de realtime.
interface RemoteProfile {
  id: string;
  timezone: string | null;
  theme: Theme | null;
  display_name: string | null;
  avatar_url: string | null;
}
interface RemoteCategory {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  archived: boolean;
  sort_order: number;
}
interface RemoteGoal {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  type: "habit" | "one_off";
  frequency: GoalFrequency;
  target_count: number;
  target_minutes: number | null;
  active: boolean;
  archived_at: string | null;
  created_at: string;
}
interface RemoteTask {
  id: string;
  user_id: string;
  goal_id: string | null;
  category_id: string | null;
  title: string;
  due_date: string | null;
  status: TaskStatus;
  estimated_minutes: number | null;
  completed_at: string | null;
  archived_at: string | null;
}
interface RemoteLog {
  id: string;
  user_id: string;
  goal_id: string | null;
  task_id: string | null;
  occurred_on: string;
  minutes_spent: number;
  source: ExecutionSource;
  client_event_id: string;
}
interface RemoteReminder {
  id: string;
  user_id: string;
  goal_id: string;
  time_local: string; // o Postgres devolve "HH:MM:SS"
  weekdays: number[];
  active: boolean;
  created_at: string;
}

/** Forma mínima de um evento `postgres_changes` do Supabase Realtime. */
export interface RealtimeChange {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

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
  private channel: RealtimeChannel | null = null;

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
      await this.pushReminders();
      await this.pushPushSubscriptions();
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
      await this.pullReminders();
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
    const { data, error } = await this.db
      .from("profiles")
      .select("id, timezone, theme, display_name, avatar_url");
    if (error) throw error;
    for (const r of (data ?? []) as RemoteProfile[]) await this.applyProfile(r);
  }

  private async pullCategories(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("categories").select("*");
    if (error) throw error;
    for (const r of (data ?? []) as RemoteCategory[]) await this.applyCategory(r);
  }

  private async pullGoals(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("goals").select("*");
    if (error) throw error;
    for (const r of (data ?? []) as RemoteGoal[]) await this.applyGoal(r);
  }

  private async pullTasks(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("tasks").select("*");
    if (error) throw error;
    for (const r of (data ?? []) as RemoteTask[]) await this.applyTask(r);
  }

  private async pullExecutionLogs(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("execution_logs").select("*");
    if (error) throw error;
    for (const r of (data ?? []) as RemoteLog[]) await this.applyExecutionLog(r);
  }

  private async pullReminders(): Promise<void> {
    if (!this.db) return;
    const { data, error } = await this.db.from("reminders").select("*");
    if (error) throw error;
    for (const r of (data ?? []) as RemoteReminder[]) await this.applyReminder(r);
  }

  // --- apply: aplica UMA linha remota ao Dexie. Reusado por pull e realtime.
  // Regra: não sobrescreve registro local pendente (`_sync = 0`); marca `_sync = 1`.

  private async applyProfile(r: RemoteProfile): Promise<void> {
    const local = await localDB.profiles.get(r.id);
    if (local && local._sync === 0) return;
    await localDB.profiles.put({
      id: r.id,
      timezone: r.timezone ?? local?.timezone ?? "UTC",
      theme: r.theme ?? local?.theme ?? "system",
      displayName: r.display_name ?? local?.displayName ?? null,
      avatarUrl: r.avatar_url ?? local?.avatarUrl ?? null,
      _sync: 1,
    });
  }

  private async applyCategory(r: RemoteCategory): Promise<void> {
    const local = await localDB.categories.get(r.id);
    if (local && local._sync === 0) return;
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

  private async applyGoal(r: RemoteGoal): Promise<void> {
    const local = await localDB.goals.get(r.id);
    if (local && local._sync === 0) return;
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

  private async applyTask(r: RemoteTask): Promise<void> {
    const local = await localDB.tasks.get(r.id);
    if (local && local._sync === 0) return;
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
      archivedAt: r.archived_at,
      _sync: 1,
    });
  }

  /** Logs são imutáveis e idempotentes por (userId, clientEventId): se já existe
   *  localmente, nunca reescreve (evita duplicar com id de servidor diferente). */
  private async applyExecutionLog(r: RemoteLog): Promise<void> {
    const existing = await localDB.executionLogs
      .where("[userId+clientEventId]")
      .equals([r.user_id, r.client_event_id])
      .first();
    if (existing) return;
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

  private async applyReminder(r: RemoteReminder): Promise<void> {
    const local = await localDB.reminders.get(r.id);
    if (local && local._sync === 0) return;
    await localDB.reminders.put({
      id: r.id,
      userId: r.user_id,
      goalId: r.goal_id,
      timeLocal: r.time_local.slice(0, 5), // "HH:MM:SS" → "HH:MM"
      weekdays: r.weekdays as Weekday[],
      active: r.active,
      createdAt: r.created_at,
      _sync: 1,
    });
  }

  // ---- Realtime (Supabase postgres_changes): sync multi-dispositivo ao vivo ----

  /**
   * Assina mudanças do servidor para o usuário e as aplica localmente em tempo
   * real. A RLS garante que só chegam as próprias linhas. Reentrante: troca o
   * canal anterior. Sem backend, é no-op.
   */
  subscribeRealtime(userId: string): void {
    if (!this.db) return;
    this.unsubscribeRealtime();
    const channel = this.db.channel(`sync:${userId}`);
    const sources: Array<{ table: string; filter: string }> = [
      { table: "goals", filter: `user_id=eq.${userId}` },
      { table: "tasks", filter: `user_id=eq.${userId}` },
      { table: "categories", filter: `user_id=eq.${userId}` },
      { table: "execution_logs", filter: `user_id=eq.${userId}` },
      { table: "profiles", filter: `id=eq.${userId}` },
      { table: "reminders", filter: `user_id=eq.${userId}` },
    ];
    for (const { table, filter } of sources) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        (payload) => void this.handleRealtimeChange(payload as unknown as RealtimeChange),
      );
    }
    channel.subscribe();
    this.channel = channel;
  }

  unsubscribeRealtime(): void {
    if (this.channel && this.db) {
      void this.db.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /** Aplica um evento de realtime ao estado local (mesmo merge do pull). */
  async handleRealtimeChange(change: RealtimeChange): Promise<void> {
    const isDelete = change.eventType === "DELETE";
    switch (change.table) {
      case "profiles":
        if (!isDelete) await this.applyProfile(change.new as unknown as RemoteProfile);
        break;
      case "categories":
        if (isDelete) await this.removeLocal(localDB.categories, change.old);
        else await this.applyCategory(change.new as unknown as RemoteCategory);
        break;
      case "goals":
        if (isDelete) await this.removeLocal(localDB.goals, change.old);
        else await this.applyGoal(change.new as unknown as RemoteGoal);
        break;
      case "tasks":
        if (isDelete) await this.removeLocal(localDB.tasks, change.old);
        else await this.applyTask(change.new as unknown as RemoteTask);
        break;
      case "execution_logs":
        // Append-only: só INSERT importa (sem update/delete).
        if (change.eventType === "INSERT") {
          await this.applyExecutionLog(change.new as unknown as RemoteLog);
        }
        break;
      case "reminders":
        if (isDelete) await this.removeLocal(localDB.reminders, change.old);
        else await this.applyReminder(change.new as unknown as RemoteReminder);
        break;
    }
    await this.refreshPending();
  }

  /** Remove um registro local apagado no servidor, preservando edições pendentes. */
  private async removeLocal<T extends { id: string; _sync: SyncState }>(
    table: Table<T, string>,
    old: Record<string, unknown>,
  ): Promise<void> {
    const id = typeof old?.id === "string" ? old.id : undefined;
    if (!id) return;
    const local = await table.get(id);
    if (local && local._sync === 0) return;
    await table.delete(id);
  }

  /** Timezone do usuário → profiles (linha já criada pelo trigger handle_new_user). */
  private async pushProfiles(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.profiles.where("_sync").equals(0).toArray();
    for (const p of rows) {
      const { error } = await this.db
        .from("profiles")
        .update({ timezone: p.timezone, theme: p.theme, display_name: p.displayName, avatar_url: p.avatarUrl })
        .eq("id", p.id);
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
        archived_at: t.archivedAt,
      });
      if (error) throw error;
      await localDB.tasks.update(t.id, { _sync: 1 });
    }
  }

  private async pushReminders(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.reminders.where("_sync").equals(0).toArray();
    for (const r of rows) {
      const { error } = await this.db.from("reminders").upsert({
        id: r.id,
        user_id: r.userId,
        goal_id: r.goalId,
        time_local: r.timeLocal,
        weekdays: r.weekdays,
        active: r.active,
      });
      if (error) throw error;
      await localDB.reminders.update(r.id, { _sync: 1 });
    }
  }

  /** Subscriptions Web Push: só upload. Upsert por `endpoint` (idempotente por dispositivo). */
  private async pushPushSubscriptions(): Promise<void> {
    if (!this.db) return;
    const rows = await localDB.pushSubscriptions.where("_sync").equals(0).toArray();
    for (const s of rows) {
      const { error } = await this.db.from("push_subscriptions").upsert(
        {
          user_id: s.userId,
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
          user_agent: s.userAgent,
        },
        { onConflict: "endpoint", ignoreDuplicates: false },
      );
      if (error) throw error;
      await localDB.pushSubscriptions.update(s.id, { _sync: 1 });
    }
  }

  private async refreshPending(): Promise<void> {
    const [g, l, t, c, p, r, s] = await Promise.all([
      localDB.goals.where("_sync").equals(0).count(),
      localDB.executionLogs.where("_sync").equals(0).count(),
      localDB.tasks.where("_sync").equals(0).count(),
      localDB.categories.where("_sync").equals(0).count(),
      localDB.profiles.where("_sync").equals(0).count(),
      localDB.reminders.where("_sync").equals(0).count(),
      localDB.pushSubscriptions.where("_sync").equals(0).count(),
    ]);
    this.patch({ pending: g + l + t + c + p + r + s });
  }

  private patch(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    for (const listener of this.listeners) listener(this.status);
  }
}
