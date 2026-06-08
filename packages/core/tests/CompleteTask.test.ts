import { beforeEach, describe, expect, it } from "vitest";
import { CompleteTask } from "../src/application/use-cases/CompleteTask.js";
import type { Task } from "../src/domain/entities/index.js";
import {
  FakeClock,
  FakeEventBus,
  FakeExecutionLogRepository,
  FakeTaskRepository,
} from "./fakes.js";

const makeTask = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  userId: "u1",
  goalId: "g1",
  categoryId: null,
  title: "Treinar",
  dueDate: "2026-06-08",
  status: "pending",
  estimatedMinutes: 30,
  completedAt: null,
  ...over,
});

describe("CompleteTask", () => {
  let tasks: FakeTaskRepository;
  let logs: FakeExecutionLogRepository;
  let bus: FakeEventBus;
  let useCase: CompleteTask;

  beforeEach(() => {
    tasks = new FakeTaskRepository([makeTask()]);
    logs = new FakeExecutionLogRepository();
    bus = new FakeEventBus();
    useCase = new CompleteTask(tasks, logs, bus, new FakeClock());
  });

  it("conclui a tarefa, registra log e publica eventos", async () => {
    await useCase.execute({
      taskId: "t1",
      userId: "u1",
      timezone: "America/Sao_Paulo",
      clientEventId: "evt-1",
      minutes: 25,
    });

    const task = await tasks.byId("t1");
    expect(task?.status).toBe("done");
    expect(task?.completedAt).not.toBeNull();
    expect(logs.store).toHaveLength(1);
    expect(logs.store[0]).toMatchObject({ occurredOn: "2026-06-08", minutesSpent: 25 });
    expect(bus.types()).toEqual(["TaskCompleted", "ExecutionLogged"]);
  });

  it("é idempotente: mesmo clientEventId não duplica o log", async () => {
    const input = {
      taskId: "t1",
      userId: "u1",
      timezone: "UTC",
      clientEventId: "evt-dup",
    };
    await useCase.execute(input);
    await useCase.execute(input); // reenvio da fila offline
    expect(logs.store).toHaveLength(1);
  });

  it("não re-salva a tarefa se já estava concluída", async () => {
    tasks = new FakeTaskRepository([makeTask({ status: "done", completedAt: "x" })]);
    useCase = new CompleteTask(tasks, logs, bus, new FakeClock());
    await useCase.execute({ taskId: "t1", userId: "u1", timezone: "UTC", clientEventId: "e" });
    expect(tasks.saveCount).toBe(0);
    expect(logs.store).toHaveLength(1);
  });

  it("rejeita tarefa inexistente", async () => {
    await expect(
      useCase.execute({ taskId: "nope", userId: "u1", timezone: "UTC", clientEventId: "e" }),
    ).rejects.toThrow("TASK_NOT_FOUND");
  });

  it("rejeita acesso de outro usuário (defesa além da RLS)", async () => {
    await expect(
      useCase.execute({ taskId: "t1", userId: "intruso", timezone: "UTC", clientEventId: "e" }),
    ).rejects.toThrow("TASK_NOT_FOUND");
  });

  it("rejeita minutos negativos", async () => {
    await expect(
      useCase.execute({
        taskId: "t1",
        userId: "u1",
        timezone: "UTC",
        clientEventId: "e",
        minutes: -1,
      }),
    ).rejects.toThrow("MINUTES_INVALID");
  });
});
