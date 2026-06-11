import Dexie, { type Table } from "dexie";
import type { Category, ExecutionLog, Goal, Task } from "@habit/core";

/**
 * Estado de sincronização de cada registro local (Fase 1 §8).
 * 0 = pendente de envio ao servidor · 1 = já sincronizado.
 * (Dexie indexa números melhor que booleanos.)
 */
export type SyncState = 0 | 1;

export type StoredGoal = Goal & { _sync: SyncState };
export type StoredTask = Task & { _sync: SyncState };
export type StoredCategory = Category & { _sync: SyncState };
export type StoredExecutionLog = ExecutionLog & { id: string; _sync: SyncState };
/** Espelho local mínimo do profile — hoje só o fuso (fonte da verdade do cálculo). */
export type StoredProfile = { id: string; timezone: string; _sync: SyncState };

export class LocalDB extends Dexie {
  goals!: Table<StoredGoal, string>;
  tasks!: Table<StoredTask, string>;
  categories!: Table<StoredCategory, string>;
  executionLogs!: Table<StoredExecutionLog, string>;
  profiles!: Table<StoredProfile, string>;

  constructor() {
    super("habit-tracker");
    this.version(1).stores({
      goals: "id, userId, categoryId, active, _sync",
      tasks: "id, userId, goalId, dueDate, status, _sync",
      executionLogs: "id, userId, goalId, occurredOn, [userId+clientEventId], _sync",
    });
    // v2: categorias (agrupamento) e profile local (timezone). Aditivo — os
    // dados das tabelas existentes são preservados na migração do Dexie.
    this.version(2).stores({
      categories: "id, userId, sortOrder, _sync",
      profiles: "id, _sync",
    });
  }
}

export const localDB = new LocalDB();
