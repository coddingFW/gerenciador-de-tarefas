import { beforeEach, describe, expect, it } from "vitest";
import { CreateTask } from "../src/application/use-cases/CreateTask.js";
import { FakeEventBus, FakeIdGenerator, FakeTaskRepository } from "./fakes.js";

describe("CreateTask", () => {
  let tasks: FakeTaskRepository;
  let bus: FakeEventBus;
  let useCase: CreateTask;

  beforeEach(() => {
    tasks = new FakeTaskRepository();
    bus = new FakeEventBus();
    useCase = new CreateTask(tasks, bus, new FakeIdGenerator());
  });

  it("cria tarefa avulsa (goalId null), pending, e publica TaskCreated", async () => {
    const task = await useCase.execute({ userId: "u1", title: "  Pagar conta  ", dueDate: "2026-06-11" });
    expect(task.title).toBe("Pagar conta");
    expect(task.goalId).toBeNull();
    expect(task.status).toBe("pending");
    expect(task.dueDate).toBe("2026-06-11");
    expect(task.completedAt).toBeNull();
    expect(bus.types()).toEqual(["TaskCreated"]);
  });

  it("rejeita título vazio", async () => {
    await expect(useCase.execute({ userId: "u1", title: "  " })).rejects.toThrow(
      "TASK_TITLE_REQUIRED",
    );
  });

  it("rejeita minutos negativos", async () => {
    await expect(
      useCase.execute({ userId: "u1", title: "x", estimatedMinutes: -5 }),
    ).rejects.toThrow("TASK_MINUTES_INVALID");
  });
});
