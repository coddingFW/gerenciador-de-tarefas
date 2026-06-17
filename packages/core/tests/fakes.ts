/** Fakes em memória para testar use-cases isoladamente (sem infra real). */
import type { DomainEvent } from "../src/domain/events/index.js";
import type {
  Category,
  ExecutionLog,
  Goal,
  IsoDate,
  Reminder,
  Task,
} from "../src/domain/entities/index.js";
import type {
  ICategoryRepository,
  IClock,
  IEventBus,
  IExecutionLogRepository,
  IGoalRepository,
  IIdGenerator,
  IProfileRepository,
  IReminderRepository,
  ITaskRepository,
  ProfileSnapshot,
  ProfileUpdate,
} from "../src/application/ports/index.js";

export class FakeClock implements IClock {
  constructor(
    private readonly fixedNow = new Date("2026-06-08T12:00:00.000Z"),
    private readonly fixedToday: IsoDate = "2026-06-08",
  ) {}
  today(): IsoDate {
    return this.fixedToday;
  }
  now(): Date {
    return this.fixedNow;
  }
}

export class FakeIdGenerator implements IIdGenerator {
  private n = 0;
  uuid(): string {
    return `id-${++this.n}`;
  }
}

export class FakeEventBus implements IEventBus {
  readonly published: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }
  types(): string[] {
    return this.published.map((e) => e.type);
  }
}

export class FakeGoalRepository implements IGoalRepository {
  readonly store = new Map<string, Goal>();
  async byId(id: string): Promise<Goal | null> {
    return this.store.get(id) ?? null;
  }
  async save(goal: Goal): Promise<void> {
    this.store.set(goal.id, goal);
  }
}

export class FakeTaskRepository implements ITaskRepository {
  readonly store = new Map<string, Task>();
  saveCount = 0;
  constructor(initial: Task[] = []) {
    for (const t of initial) this.store.set(t.id, t);
  }
  async byId(id: string): Promise<Task | null> {
    return this.store.get(id) ?? null;
  }
  async save(task: Task): Promise<void> {
    this.saveCount++;
    this.store.set(task.id, task);
  }
  async pendingFor(userId: string, date: IsoDate): Promise<Task[]> {
    return [...this.store.values()].filter(
      (t) => t.userId === userId && t.status === "pending" && t.dueDate === date,
    );
  }
}

export class FakeCategoryRepository implements ICategoryRepository {
  readonly store = new Map<string, Category>();
  constructor(initial: Category[] = []) {
    for (const c of initial) this.store.set(c.id, c);
  }
  async byId(id: string): Promise<Category | null> {
    return this.store.get(id) ?? null;
  }
  async save(category: Category): Promise<void> {
    this.store.set(category.id, category);
  }
  async listFor(userId: string): Promise<Category[]> {
    return [...this.store.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

export class FakeProfileRepository implements IProfileRepository {
  readonly timezones = new Map<string, string>();
  readonly profiles = new Map<string, ProfileSnapshot>();
  writes = 0;
  constructor(initial: Record<string, string> = {}) {
    for (const [id, tz] of Object.entries(initial)) this.timezones.set(id, tz);
  }
  async getTimezone(userId: string): Promise<string | null> {
    return this.timezones.get(userId) ?? null;
  }
  async setTimezone(userId: string, timezone: string): Promise<void> {
    this.writes++;
    this.timezones.set(userId, timezone);
  }
  async getProfile(userId: string): Promise<ProfileSnapshot | null> {
    return this.profiles.get(userId) ?? null;
  }
  async updateProfile(userId: string, patch: ProfileUpdate): Promise<void> {
    this.writes++;
    const cur: ProfileSnapshot = this.profiles.get(userId) ?? {
      timezone: this.timezones.get(userId) ?? "UTC",
      theme: "system",
      displayName: null,
      avatarUrl: null,
    };
    this.profiles.set(userId, { ...cur, ...patch });
  }
}

export class FakeReminderRepository implements IReminderRepository {
  readonly store = new Map<string, Reminder>();
  constructor(initial: Reminder[] = []) {
    for (const r of initial) this.store.set(r.id, r);
  }
  async byId(id: string): Promise<Reminder | null> {
    return this.store.get(id) ?? null;
  }
  async save(reminder: Reminder): Promise<void> {
    this.store.set(reminder.id, reminder);
  }
  async listForUser(userId: string): Promise<Reminder[]> {
    return [...this.store.values()].filter((r) => r.userId === userId);
  }
}

/** Repositório append-only idempotente por (userId, clientEventId). */
export class FakeExecutionLogRepository implements IExecutionLogRepository {
  readonly store: ExecutionLog[] = [];
  async append(log: ExecutionLog): Promise<void> {
    const key = `${log.userId}:${log.clientEventId}`;
    const exists = this.store.some((l) => `${l.userId}:${l.clientEventId}` === key);
    if (!exists) this.store.push(log);
  }
  async forGoal(goalId: string): Promise<ExecutionLog[]> {
    return this.store.filter((l) => l.goalId === goalId);
  }
}
