/** Fakes em memória para testar use-cases isoladamente (sem infra real). */
import type { DomainEvent } from "../src/domain/events/index.js";
import type {
  ExecutionLog,
  Goal,
  IsoDate,
  Task,
} from "../src/domain/entities/index.js";
import type {
  IClock,
  IEventBus,
  IExecutionLogRepository,
  IGoalRepository,
  IIdGenerator,
  ITaskRepository,
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
