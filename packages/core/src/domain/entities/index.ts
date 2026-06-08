/**
 * Entidades de domínio — estruturas puras, sem dependência de infraestrutura.
 * Datas no formato ISO `YYYY-MM-DD` representam o "dia" no fuso do usuário.
 */

export type UserRole = "user" | "admin";
export type UserPlan = "free" | "premium";
export type GoalFrequency = "daily" | "weekly" | "monthly";
export type TaskStatus = "pending" | "done" | "skipped";
export type ExecutionSource = "manual" | "timer" | "import";

/** ISO date `YYYY-MM-DD` (dia no fuso do usuário). */
export type IsoDate = string;

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  plan: UserPlan;
  timezone: string;
  onboardingCompletedAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  icon: string | null;
  archived: boolean;
  sortOrder: number;
}

export interface Goal {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  type: "habit" | "one_off";
  frequency: GoalFrequency;
  targetCount: number;
  targetMinutes: number | null;
  active: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  goalId: string | null;
  categoryId: string | null;
  title: string;
  dueDate: IsoDate | null;
  status: TaskStatus;
  estimatedMinutes: number | null;
  completedAt: string | null;
}

/** Fato imutável (append-only) — base de todas as métricas. */
export interface ExecutionLog {
  userId: string;
  goalId: string | null;
  taskId: string | null;
  occurredOn: IsoDate;
  minutesSpent: number;
  source: ExecutionSource;
  /** Idempotência da sincronização offline. */
  clientEventId: string;
}

/** Estado derivado (cacheado) — nunca editado manualmente. */
export interface Streak {
  userId: string;
  goalId: string;
  currentCount: number;
  bestCount: number;
  lastExecutionOn: IsoDate | null;
  periodType: GoalFrequency;
}
