/**
 * Ports (interfaces) definidos pelo domínio. A infraestrutura fornece os
 * Adapters (SupabaseRepository, IndexedDbRepository, etc.). Regra de dependência
 * da Clean Architecture: o domínio depende destas abstrações, nunca do concreto.
 */
import type { ExecutionLog, Goal, IsoDate, Task } from "../../domain/entities/index.js";
import type { DomainEvent } from "../../domain/events/index.js";

export interface IClock {
  /** "Hoje" no fuso informado, como `YYYY-MM-DD`. */
  today(timezone: string): IsoDate;
  now(): Date;
}

export interface IIdGenerator {
  uuid(): string;
}

export interface IGoalRepository {
  byId(id: string): Promise<Goal | null>;
  save(goal: Goal): Promise<void>;
}

export interface ITaskRepository {
  byId(id: string): Promise<Task | null>;
  save(task: Task): Promise<void>;
  pendingFor(userId: string, date: IsoDate): Promise<Task[]>;
}

export interface IExecutionLogRepository {
  /** Idempotente por (userId, clientEventId). Reenvio não duplica. */
  append(log: ExecutionLog): Promise<void>;
  forGoal(goalId: string): Promise<ExecutionLog[]>;
}

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
}

// --- Ports preparados para o futuro (sem lock-in) ---

export interface IAIProvider {
  suggestHabits(input: { history: ExecutionLog[]; goals: Goal[] }): Promise<string[]>;
  generateInsights(input: { metrics: Record<string, number> }): Promise<string>;
}

export interface IPaymentProvider {
  createCheckout(userId: string, plan: "premium"): Promise<{ url: string }>;
  verifyWebhook(raw: string, signature: string): Promise<{ userId: string; plan: string }>;
}
