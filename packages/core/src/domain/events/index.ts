/**
 * Catálogo de Domain Events (Fase 1 §6). Todo evento persistido no outbox
 * (`domain_events`) alimenta métricas, auditoria, analytics e IA.
 */

export type DomainEventType =
  | "UserCreated"
  | "UserLoggedIn"
  | "ProfileUpdated"
  | "TaskCreated"
  | "TaskCompleted"
  | "TaskSkipped"
  | "TaskArchived"
  | "TaskUpdated"
  | "CategoryCreated"
  | "CategoryUpdated"
  | "GoalCreated"
  | "GoalUpdated"
  | "GoalArchived"
  | "GoalAchieved"
  | "ReminderScheduled"
  | "ReminderCancelled"
  | "ExecutionLogged"
  | "StreakStarted"
  | "StreakExtended"
  | "StreakBroken"
  | "FeatureEnabled"
  | "FeatureDisabled"
  | "PlanUpgraded"
  | "AdminActionPerformed";

export interface DomainEvent<T = Record<string, unknown>> {
  type: DomainEventType;
  aggregateId: string;
  userId: string | null;
  payload: T;
  /** Preenchido pela infraestrutura ao persistir, se ausente. */
  occurredAt?: string;
  schemaVersion?: number;
}

export function createEvent<T extends Record<string, unknown>>(
  type: DomainEventType,
  aggregateId: string,
  userId: string | null,
  payload: T,
): DomainEvent<T> {
  return { type, aggregateId, userId, payload, schemaVersion: 1 };
}
