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
