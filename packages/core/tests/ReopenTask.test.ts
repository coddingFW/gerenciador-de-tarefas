import { beforeEach, describe, expect, it } from "vitest";
import { ReopenTask } from "../src/application/use-cases/ReopenTask.js";
import type { Task } from "../src/domain/entities/index.js";
import { FakeTaskRepository } from "./fakes.js";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  userId: "u1",
  goalId: null,
  categoryId: null,
  title: "Pagar conta",
  dueDate: "2026-06-11",
  status: "done",
  estimatedMinutes: null,
  completedAt: "2026-06-11T10:00:00.000Z",
  archivedAt: null,
  ...over,
});

describe("ReopenTask", () => {
  let tasks: FakeTaskRepository;
  let useCase: ReopenTask;

  beforeEach(() => {
    tasks = new FakeTaskRepository([task()]);
    useCase = new ReopenTask(tasks);
  });

  it("reverte status e limpa completedAt (Opção 1: log permanece)", async () => {
    const t = await useCase.execute({ taskId: "t1", userId: "u1" });
    expect(t.status).toBe("pending");
    expect(t.completedAt).toBeNull();
    expect(tasks.saveCount).toBe(1);
  });

  it("é no-op quando a tarefa já está pendente", async () => {
    tasks = new FakeTaskRepository([task({ status: "pending", completedAt: null })]);
    useCase = new ReopenTask(tasks);
    await useCase.execute({ taskId: "t1", userId: "u1" });
    expect(tasks.saveCount).toBe(0);
  });

  it("não deixa outro usuário desfazer (ownership)", async () => {
    await expect(useCase.execute({ taskId: "t1", userId: "intruso" })).rejects.toThrow(
      "TASK_NOT_FOUND",
    );
  });
});
