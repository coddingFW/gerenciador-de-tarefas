import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import type { Task } from "@habit/core";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";

/**
 * Tarefas AVULSAS (one-off, goalId null) — separadas dos hábitos recorrentes.
 * Conclusão otimista via CompleteTask (gera ExecutionLog); desfazer via
 * ReopenTask (reverte status; o log permanece — decisão de domínio Opção 1).
 */
export function TasksPage({ user }: { user: CurrentUser }) {
  const tasks = useLiveQuery(
    () =>
      localDB.tasks
        .where("userId")
        .equals(user.id)
        .filter((t) => t.goalId === null)
        .toArray(),
    [user.id],
  );

  const pending = tasks?.filter((t) => t.status === "pending" && !t.archivedAt) ?? [];
  const done = tasks?.filter((t) => t.status === "done" && !t.archivedAt) ?? [];

  return (
    <div class="flex flex-col gap-4">
      <AddTaskForm user={user} />

      <section>
        <div class="mb-2 flex items-baseline justify-between">
          <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Pendentes</h2>
          {tasks && <span class="text-xs text-slate-500 dark:text-slate-400">{pending.length}</span>}
        </div>
        {tasks === undefined ? (
          <Skeleton />
        ) : pending.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhuma tarefa pendente. Crie uma acima 👆
          </p>
        ) : (
          <ul class="flex flex-col gap-2">
            {pending.map((t) => (
              <TaskRow key={t.id} task={t} user={user} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 class="mb-2 text-sm font-semibold text-slate-700">Concluídas</h2>
          <ul class="flex flex-col gap-2">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} user={user} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AddTaskForm({ user }: { user: CurrentUser }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await container.createTask.execute({
        userId: user.id,
        title,
        dueDate: container.clock.today(user.timezone),
      });
      setTitle("");
      void container.sync.flush();
    } catch {
      setError("Informe um título válido para a tarefa.");
    }
  };

  return (
    <form onSubmit={submit} class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Nova tarefa</h2>
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          placeholder="Ex.: Pagar a conta de luz"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Adicionar
        </button>
      </div>
      {error && <p class="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

function TaskRow({ task, user }: { task: Task; user: CurrentUser }) {
  const done = task.status === "done";

  const complete = async () => {
    await container.completeTask.execute({
      taskId: task.id,
      userId: user.id,
      timezone: user.timezone,
      clientEventId: crypto.randomUUID(),
    });
    void container.sync.flush();
  };

  const undo = async () => {
    await container.reopenTask.execute({ taskId: task.id, userId: user.id });
    void container.sync.flush();
  };

  const remove = async () => {
    await container.archiveTask.execute({ taskId: task.id, userId: user.id });
    void container.sync.flush();
  };

  return (
    <li class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p class={`min-w-0 truncate text-sm font-medium ${done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
        {task.title}
      </p>
      <div class="ml-3 flex shrink-0 items-center gap-1">
        {done ? (
          <button
            onClick={() => void undo()}
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Desfazer
          </button>
        ) : (
          <button
            onClick={() => void complete()}
            class="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Concluir
          </button>
        )}
        <button
          onClick={() => void remove()}
          aria-label="Excluir tarefa"
          class="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
        >
          🗑
        </button>
      </div>
    </li>
  );
}

function Skeleton() {
  return (
    <ul class="flex flex-col gap-2">
      {[0, 1].map((i) => (
        <li key={i} class="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
      ))}
    </ul>
  );
}
