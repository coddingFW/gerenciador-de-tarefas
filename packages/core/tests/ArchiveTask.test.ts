import { beforeEach, describe, expect, it } from "vitest";
import { ArchiveTask } from "../src/application/use-cases/ArchiveTask.js";
import type { Task } from "../src/domain/entities/index.js";
import { FakeClock, FakeEventBus, FakeTaskRepository } from "./fakes.js";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  userId: "u1",
  goalId: null,
  categoryId: null,
  title: "Pagar conta",
  dueDate: "2026-06-11",
  status: "pending",
  estimatedMinutes: null,
  completedAt: null,
  archivedAt: null,
  ...over,
});

describe("ArchiveTask", () => {
  let tasks: FakeTaskRepository;
  let bus: FakeEventBus;
  let useCase: ArchiveTask;

  beforeEach(() => {
    tasks = new FakeTaskRepository([task()]);
    bus = new FakeEventBus();
    useCase = new ArchiveTask(tasks, bus, new FakeClock());
  });

  it("arquiva a tarefa (define archivedAt) e publica TaskArchived", async () => {
    const t = await useCase.execute({ taskId: "t1", userId: "u1" });
    expect(t.archivedAt).not.toBeNull();
    expect(bus.types()).toEqual(["TaskArchived"]);
  });

  it("é idempotente: tarefa já arquivada não republica evento", async () => {
    tasks = new FakeTaskRepository([task({ archivedAt: "2026-06-11T00:00:00.000Z" })]);
    useCase = new ArchiveTask(tasks, bus, new FakeClock());
    await useCase.execute({ taskId: "t1", userId: "u1" });
    expect(bus.types()).toEqual([]);
  });

  it("rejeita tarefa inexistente", async () => {
    await expect(useCase.execute({ taskId: "nope", userId: "u1" })).rejects.toThrow("TASK_NOT_FOUND");
  });

  it("rejeita arquivar tarefa de outro usuário", async () => {
    await expect(useCase.execute({ taskId: "t1", userId: "u2" })).rejects.toThrow("TASK_NOT_FOUND");
  });
});
