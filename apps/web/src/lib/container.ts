import { ArchiveGoal, CompleteTask, CreateGoal, EditGoal, LogExecution } from "@habit/core";
import { SystemClock } from "../infrastructure/adapters/SystemClock";
import { CryptoIdGenerator } from "../infrastructure/adapters/CryptoIdGenerator";
import { LocalEventBus } from "../infrastructure/adapters/LocalEventBus";
import {
  LocalExecutionLogRepository,
  LocalGoalRepository,
  LocalTaskRepository,
} from "../infrastructure/persistence/LocalRepositories";
import { SyncEngine } from "../infrastructure/sync/SyncEngine";
import { supabase } from "../infrastructure/supabase/client";

/**
 * Composition Root (Fase 2 §6): único lugar onde Ports encontram Adapters.
 * Trocar o backend ou o armazenamento = mudar SÓ este arquivo. O domínio
 * (@habit/core) permanece intacto.
 */
const clock = new SystemClock();
const ids = new CryptoIdGenerator();
const bus = new LocalEventBus();

const goals = new LocalGoalRepository();
const tasks = new LocalTaskRepository();
const logs = new LocalExecutionLogRepository();

export const container = {
  createGoal: new CreateGoal(goals, bus, clock, ids),
  editGoal: new EditGoal(goals, bus),
  archiveGoal: new ArchiveGoal(goals, bus, clock),
  logExecution: new LogExecution(goals, logs, bus, clock),
  completeTask: new CompleteTask(tasks, logs, bus, clock),
  sync: new SyncEngine(supabase),
  clock,
};
