import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { localDB } from "../persistence/db";
import { SyncEngine } from "./SyncEngine";

/** Stub mínimo do SupabaseClient: `select` devolve o "servidor"; push é no-op. */
function fakeSupabase(remote: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      return {
        select: () => Promise.resolve({ data: remote[table] ?? [], error: null }),
        upsert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: () => {
          const chain: Record<string, unknown> = {};
          chain.eq = () => chain;
          chain.is = () => Promise.resolve({ error: null });
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
}

async function clearDB() {
  await Promise.all([
    localDB.profiles.clear(),
    localDB.categories.clear(),
    localDB.goals.clear(),
    localDB.tasks.clear(),
    localDB.executionLogs.clear(),
  ]);
}

describe("SyncEngine.pull", () => {
  beforeEach(clearDB);

  it("baixa o estado do servidor para o Dexie e marca como sincronizado", async () => {
    const remote = {
      profiles: [{ id: "u1", timezone: "America/Sao_Paulo" }],
      categories: [
        { id: "c1", user_id: "u1", name: "Saúde", color: "#0ea5e9", icon: "💪", archived: false, sort_order: 0 },
      ],
      goals: [
        {
          id: "g1",
          user_id: "u1",
          category_id: "c1",
          title: "Beber água",
          description: null,
          type: "habit",
          frequency: "daily",
          target_count: 1,
          target_minutes: null,
          active: true,
          archived_at: null,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      tasks: [
        {
          id: "t1",
          user_id: "u1",
          goal_id: null,
          category_id: null,
          title: "Pagar conta",
          due_date: "2026-06-11",
          status: "pending",
          estimated_minutes: null,
          completed_at: null,
        },
      ],
      execution_logs: [
        {
          id: "l1",
          user_id: "u1",
          goal_id: "g1",
          task_id: null,
          occurred_on: "2026-06-11",
          minutes_spent: 10,
          source: "manual",
          client_event_id: "ce1",
        },
      ],
    };

    await new SyncEngine(fakeSupabase(remote)).pull();

    const goal = await localDB.goals.get("g1");
    expect(goal).toMatchObject({ id: "g1", userId: "u1", categoryId: "c1", title: "Beber água", _sync: 1 });
    expect(await localDB.profiles.get("u1")).toMatchObject({ timezone: "America/Sao_Paulo", _sync: 1 });
    expect(await localDB.categories.get("c1")).toMatchObject({ name: "Saúde", sortOrder: 0, _sync: 1 });
    expect(await localDB.tasks.get("t1")).toMatchObject({ title: "Pagar conta", dueDate: "2026-06-11", _sync: 1 });
    const logs = await localDB.executionLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ clientEventId: "ce1", minutesSpent: 10, _sync: 1 });
  });

  it("não sobrescreve um registro local pendente (_sync = 0 vence)", async () => {
    await localDB.goals.put({
      id: "g1",
      userId: "u1",
      categoryId: null,
      title: "Edição local",
      description: null,
      type: "habit",
      frequency: "daily",
      targetCount: 1,
      targetMinutes: null,
      active: true,
      archivedAt: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      _sync: 0,
    });

    const remote = {
      goals: [
        {
          id: "g1",
          user_id: "u1",
          category_id: null,
          title: "Versão do servidor",
          description: null,
          type: "habit",
          frequency: "daily",
          target_count: 1,
          target_minutes: null,
          active: true,
          archived_at: null,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
    };

    await new SyncEngine(fakeSupabase(remote)).pull();

    const goal = await localDB.goals.get("g1");
    expect(goal?.title).toBe("Edição local");
    expect(goal?._sync).toBe(0);
  });

  it("remove log local já sincronizado que sumiu do servidor (limpeza); preserva pendente", async () => {
    // Sincronizado e ausente do servidor → deve ser removido.
    await localDB.executionLogs.put({
      id: "stale",
      userId: "u1",
      goalId: "g1",
      taskId: null,
      occurredOn: "2026-06-16",
      minutesSpent: 0,
      source: "manual",
      clientEventId: "ce-stale",
      _sync: 1,
    });
    // Pendente (ainda não subiu) e ausente do servidor → deve ser preservado.
    await localDB.executionLogs.put({
      id: "pending",
      userId: "u1",
      goalId: "g1",
      taskId: null,
      occurredOn: "2026-06-20",
      minutesSpent: 0,
      source: "manual",
      clientEventId: "ce-pending",
      _sync: 0,
    });

    const remote = {
      execution_logs: [
        {
          id: "kept",
          user_id: "u1",
          goal_id: "g1",
          task_id: null,
          occurred_on: "2026-06-20",
          minutes_spent: 0,
          source: "manual",
          client_event_id: "ce-kept",
        },
      ],
    };

    await new SyncEngine(fakeSupabase(remote)).pull();

    expect(await localDB.executionLogs.get("stale")).toBeUndefined();
    expect(await localDB.executionLogs.get("pending")).toBeDefined();
    const kept = (await localDB.executionLogs.toArray()).find((l) => l.clientEventId === "ce-kept");
    expect(kept).toBeDefined();
  });

  it("deduplica execution_logs por (userId, clientEventId) — nunca duplica", async () => {
    await localDB.executionLogs.put({
      id: "local-id",
      userId: "u1",
      goalId: "g1",
      taskId: null,
      occurredOn: "2026-06-11",
      minutesSpent: 10,
      source: "manual",
      clientEventId: "ce1",
      _sync: 1,
    });

    const remote = {
      execution_logs: [
        {
          id: "server-id",
          user_id: "u1",
          goal_id: "g1",
          task_id: null,
          occurred_on: "2026-06-11",
          minutes_spent: 10,
          source: "manual",
          client_event_id: "ce1",
        },
      ],
    };

    await new SyncEngine(fakeSupabase(remote)).pull();

    const logs = (await localDB.executionLogs.toArray()).filter((l) => l.clientEventId === "ce1");
    expect(logs).toHaveLength(1);
    expect(logs[0]!.id).toBe("local-id");
  });
});

describe("SyncEngine.deleteHabitLog", () => {
  beforeEach(clearDB);

  it("apaga o log do hábito do dia (goal direto, task_id null) localmente", async () => {
    await localDB.executionLogs.bulkPut([
      // alvo: hábito direto no dia 16
      {
        id: "h16",
        userId: "u1",
        goalId: "g1",
        taskId: null,
        occurredOn: "2026-06-16",
        minutesSpent: 0,
        source: "manual",
        clientEventId: "ce-h16",
        _sync: 1,
      },
      // outro dia — não deve ser tocado
      {
        id: "h20",
        userId: "u1",
        goalId: "g1",
        taskId: null,
        occurredOn: "2026-06-20",
        minutesSpent: 0,
        source: "manual",
        clientEventId: "ce-h20",
        _sync: 1,
      },
      // log de tarefa (task_id != null) no mesmo dia — não deve ser tocado
      {
        id: "t16",
        userId: "u1",
        goalId: "g1",
        taskId: "task1",
        occurredOn: "2026-06-16",
        minutesSpent: 0,
        source: "manual",
        clientEventId: "ce-t16",
        _sync: 1,
      },
    ]);

    await new SyncEngine(fakeSupabase({})).deleteHabitLog("u1", "g1", "2026-06-16");

    expect(await localDB.executionLogs.get("h16")).toBeUndefined();
    expect(await localDB.executionLogs.get("h20")).toBeDefined();
    expect(await localDB.executionLogs.get("t16")).toBeDefined();
  });
});

const remoteGoal = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  user_id: "u1",
  category_id: null,
  title: "Do servidor",
  description: null,
  type: "habit",
  frequency: "daily",
  target_count: 1,
  target_minutes: null,
  active: true,
  archived_at: null,
  created_at: "2026-06-01T00:00:00.000Z",
  ...over,
});

describe("SyncEngine.handleRealtimeChange", () => {
  beforeEach(clearDB);
  const engine = () => new SyncEngine(fakeSupabase({}));

  it("INSERT/UPDATE aplica a linha do servidor localmente", async () => {
    await engine().handleRealtimeChange({
      table: "goals",
      eventType: "INSERT",
      new: remoteGoal(),
      old: {},
    });
    expect(await localDB.goals.get("g1")).toMatchObject({ title: "Do servidor", _sync: 1 });
  });

  it("UPDATE não sobrescreve um registro local pendente", async () => {
    await localDB.goals.put({
      id: "g1",
      userId: "u1",
      categoryId: null,
      title: "Edição local",
      description: null,
      type: "habit",
      frequency: "daily",
      targetCount: 1,
      targetMinutes: null,
      active: true,
      archivedAt: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      _sync: 0,
    });
    await engine().handleRealtimeChange({
      table: "goals",
      eventType: "UPDATE",
      new: remoteGoal({ title: "Sobrescrito" }),
      old: {},
    });
    expect((await localDB.goals.get("g1"))?.title).toBe("Edição local");
  });

  it("DELETE remove o registro local sincronizado", async () => {
    await localDB.categories.put({
      id: "c1",
      userId: "u1",
      name: "Saúde",
      color: null,
      icon: null,
      archived: false,
      sortOrder: 0,
      _sync: 1,
    });
    await engine().handleRealtimeChange({
      table: "categories",
      eventType: "DELETE",
      new: {},
      old: { id: "c1" },
    });
    expect(await localDB.categories.get("c1")).toBeUndefined();
  });

  it("DELETE preserva um registro local pendente", async () => {
    await localDB.categories.put({
      id: "c1",
      userId: "u1",
      name: "Pendente",
      color: null,
      icon: null,
      archived: false,
      sortOrder: 0,
      _sync: 0,
    });
    await engine().handleRealtimeChange({
      table: "categories",
      eventType: "DELETE",
      new: {},
      old: { id: "c1" },
    });
    expect(await localDB.categories.get("c1")).toBeDefined();
  });
});
