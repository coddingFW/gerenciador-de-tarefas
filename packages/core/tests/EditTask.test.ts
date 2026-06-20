import { beforeEach, describe, expect, it } from "vitest";
import { EditTask } from "../src/application/use-cases/EditTask.js";
import type { Task } from "../src/domain/entities/index.js";
import { FakeEventBus, FakeTaskRepository } from "./fakes.js";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  userId: "u1",
  goalId: null,
  categoryId: null,
  title: "Pagar conta",
  dueDate: "2026-06-19",
  status: "pending",
  estimatedMinutes: null,
  completedAt: null,
  archivedAt: null,
  ...over,
});

describe("EditTask", () => {
  let tasks: FakeTaskRepository;
  let bus: FakeEventBus;
  let useCase: EditTask;

  beforeEach(() => {
    tasks = new FakeTaskRepository([task()]);
    bus = new FakeEventBus();
    useCase = new EditTask(tasks, bus);
  });

  it("remarca a data e publica TaskUpdated", async () => {
    const t = await useCase.execute({ taskId: "t1", userId: "u1", dueDate: "2026-06-25" });
    expect(t.dueDate).toBe("2026-06-25");
    expect(bus.types()).toEqual(["TaskUpdated"]);
  });

  it("edita o título com trim", async () => {
    const t = await useCase.execute({ taskId: "t1", userId: "u1", title: "  Pagar luz  " });
    expect(t.title).toBe("Pagar luz");
  });

  it("aceita dueDate null (sem data)", async () => {
    const t = await useCase.execute({ taskId: "t1", userId: "u1", dueDate: null });
    expect(t.dueDate).toBeNull();
  });

  it("rejeita título vazio", async () => {
    await expect(useCase.execute({ taskId: "t1", userId: "u1", title: "  " })).rejects.toThrow(
      "TASK_TITLE_REQUIRED",
    );
  });

  it("rejeita data em formato inválido", async () => {
    await expect(
      useCase.execute({ taskId: "t1", userId: "u1", dueDate: "25/06/2026" }),
    ).rejects.toThrow("TASK_DUE_DATE_INVALID");
  });

  it("atualiza estimatedMinutes", async () => {
    const t = await useCase.execute({ taskId: "t1", userId: "u1", estimatedMinutes: 30 });
    expect(t.estimatedMinutes).toBe(30);
    expect(bus.types()).toEqual(["TaskUpdated"]);
  });

  it("aceita estimatedMinutes null e rejeita negativo", async () => {
    const t = await useCase.execute({ taskId: "t1", userId: "u1", estimatedMinutes: null });
    expect(t.estimatedMinutes).toBeNull();
    await expect(
      useCase.execute({ taskId: "t1", userId: "u1", estimatedMinutes: -5 }),
    ).rejects.toThrow("TASK_MINUTES_INVALID");
  });

  it("no-op sem campos (não publica evento)", async () => {
    await useCase.execute({ taskId: "t1", userId: "u1" });
    expect(bus.types()).toEqual([]);
  });

  it("rejeita tarefa de outro usuário", async () => {
    await expect(
      useCase.execute({ taskId: "t1", userId: "u2", title: "x" }),
    ).rejects.toThrow("TASK_NOT_FOUND");
  });
});
