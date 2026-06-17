/**
 * Ports (interfaces) definidos pelo domínio. A infraestrutura fornece os
 * Adapters (SupabaseRepository, IndexedDbRepository, etc.). Regra de dependência
 * da Clean Architecture: o domínio depende destas abstrações, nunca do concreto.
 */
import type { Category, ExecutionLog, Goal, IsoDate, Reminder, Task } from "../../domain/entities/index.js";
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

export interface ICategoryRepository {
  byId(id: string): Promise<Category | null>;
  save(category: Category): Promise<void>;
  /** Categorias do usuário, ordenadas por `sortOrder`. */
  listFor(userId: string): Promise<Category[]>;
}

export interface IReminderRepository {
  byId(id: string): Promise<Reminder | null>;
  save(reminder: Reminder): Promise<void>;
  /** Lembretes do usuário (ativos e inativos). */
  listForUser(userId: string): Promise<Reminder[]>;
}

export interface IProfileRepository {
  /** Fuso persistido do usuário, ou `null` se ainda desconhecido. */
  getTimezone(userId: string): Promise<string | null>;
  setTimezone(userId: string, timezone: string): Promise<void>;
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
