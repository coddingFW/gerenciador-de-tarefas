/**
 * Entidades de domínio — estruturas puras, sem dependência de infraestrutura.
 * Datas no formato ISO `YYYY-MM-DD` representam o "dia" no fuso do usuário.
 */

export type UserRole = "user" | "admin";
export type UserPlan = "free" | "premium";
/** Preferência de tema da UI (default 'system' = segue o SO). */
export type Theme = "light" | "dark" | "system";
export type GoalFrequency = "daily" | "weekly" | "monthly";
export type TaskStatus = "pending" | "done" | "skipped";
export type ExecutionSource = "manual" | "timer" | "import";

/** Dia da semana no padrão ISO-8601: 1 = segunda … 7 = domingo (casa com `extract(isodow)`). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** ISO date `YYYY-MM-DD` (dia no fuso do usuário). */
export type IsoDate = string;

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  plan: UserPlan;
  timezone: string;
  theme: Theme;
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

/**
 * Lembrete recorrente de um hábito (Fase 2). Recorrência simples: um horário
 * local (`HH:MM`, no fuso do usuário) em um conjunto de dias da semana.
 */
export interface Reminder {
  id: string;
  userId: string;
  goalId: string;
  /** Horário local `HH:MM` (24h) no fuso do usuário. */
  timeLocal: string;
  /** Dias da semana (ISO-DOW 1..7) em que dispara. */
  weekdays: Weekday[];
  active: boolean;
  createdAt: string;
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
