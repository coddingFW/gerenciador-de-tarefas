import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import type { Goal, IsoDate, Task } from "@habit/core";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import {
  WEEKDAYS,
  addDays,
  addMonths,
  dayLabel,
  daysInMonth,
  firstWeekday,
  iso,
  monthLabel,
  parseIso,
} from "./dateUtils";

const MAX_DOTS = 4;

/** Aba Calendário (Fase: calendário). Lê tarefas (dueDate) e execuções de hábitos
 *  (occurredOn) do Dexie — offline-first, sem migration. Datas no fuso do usuário. */
export function CalendarPage({ user }: { user: CurrentUser }) {
  const today = container.clock.today(user.timezone);
  const init = parseIso(today);
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const [view, setView] = useState({ y: init.y, m: init.m });
  const [selected, setSelected] = useState<IsoDate>(today);

  const tasks =
    useLiveQuery(
      () =>
        localDB.tasks
          .where("userId")
          .equals(user.id)
          .filter((t) => !t.archivedAt && t.goalId === null)
          .toArray(),
      [user.id],
    ) ?? [];

  const logs =
    useLiveQuery(
      () =>
        localDB.executionLogs
          .where("userId")
          .equals(user.id)
          .filter((l) => l.goalId != null)
          .toArray(),
      [user.id],
    ) ?? [];

  const goals =
    useLiveQuery(
      () => localDB.goals.where("userId").equals(user.id).filter((g) => g.active).toArray(),
      [user.id],
    ) ?? [];

  const tasksByDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const list = tasksByDate.get(t.dueDate) ?? [];
    list.push(t);
    tasksByDate.set(t.dueDate, list);
  }
  const doneHabitsByDate = new Map<string, Set<string>>();
  for (const l of logs) {
    if (l.goalId) {
      const set = doneHabitsByDate.get(l.occurredOn) ?? new Set<string>();
      set.add(l.goalId);
      doneHabitsByDate.set(l.occurredOn, set);
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <div class="inline-flex gap-1 self-start rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <ModeButton active={mode === "month"} onClick={() => setMode("month")}>
          Mês
        </ModeButton>
        <ModeButton active={mode === "agenda"} onClick={() => setMode("agenda")}>
          Agenda
        </ModeButton>
      </div>

      {mode === "month" ? (
        <MonthView
          view={view}
          setView={setView}
          today={today}
          selected={selected}
          setSelected={setSelected}
          tasksByDate={tasksByDate}
          doneHabitsByDate={doneHabitsByDate}
          goals={goals}
          user={user}
        />
      ) : (
        <AgendaView tasks={tasks} user={user} today={today} />
      )}
    </div>
  );
}

function MonthView({
  view,
  setView,
  today,
  selected,
  setSelected,
  tasksByDate,
  doneHabitsByDate,
  goals,
  user,
}: {
  view: { y: number; m: number };
  setView: (v: { y: number; m: number }) => void;
  today: IsoDate;
  selected: IsoDate;
  setSelected: (d: IsoDate) => void;
  tasksByDate: Map<string, Task[]>;
  doneHabitsByDate: Map<string, Set<string>>;
  goals: Goal[];
  user: CurrentUser;
}) {
  const dim = daysInMonth(view.y, view.m);
  const offset = firstWeekday(view.y, view.m);
  const cells: Array<number | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <button
          onClick={() => setView(addMonths(view.y, view.m, -1))}
          aria-label="Mês anterior"
          class="rounded-lg px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ‹
        </button>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {monthLabel(view.y, view.m)}
          </span>
          <button
            onClick={() => {
              const t = parseIso(today);
              setView({ y: t.y, m: t.m });
              setSelected(today);
            }}
            class="rounded-lg px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand/10"
          >
            Hoje
          </button>
        </div>
        <button
          onClick={() => setView(addMonths(view.y, view.m, 1))}
          aria-label="Próximo mês"
          class="rounded-lg px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ›
        </button>
      </div>

      <div class="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={`wd${i}`} class="py-1 text-center text-xs text-slate-400 dark:text-slate-500">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dIso = iso(view.y, view.m, d);
          const dayTasks = tasksByDate.get(dIso) ?? [];
          const doneCount = dayTasks.filter((t) => t.status === "done").length;
          const isToday = dIso === today;
          const isSel = dIso === selected;
          const overdue = dIso < today && dayTasks.some((t) => t.status === "pending");
          const base = isSel
            ? "bg-brand text-white"
            : overdue
              ? "font-medium text-red-600 dark:text-red-400"
              : "text-slate-600 dark:text-slate-300";
          return (
            <button
              key={dIso}
              onClick={() => setSelected(dIso)}
              aria-label={`${dayLabel(dIso)}${doneCount > 0 ? ` — ${doneCount} tarefa(s) concluída(s)` : ""}`}
              aria-pressed={isSel}
              class={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm ${base} ${
                isToday && !isSel ? "ring-2 ring-brand" : ""
              }`}
            >
              <span>{d}</span>
              <span class="flex h-1.5 items-center gap-0.5">
                {Array.from({ length: Math.min(doneCount, MAX_DOTS) }).map((_, j) => (
                  <span
                    key={j}
                    class={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-white" : "bg-emerald-500"}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <DayDetail
        selected={selected}
        tasks={tasksByDate.get(selected) ?? []}
        goals={goals}
        doneHabits={doneHabitsByDate.get(selected) ?? new Set<string>()}
        user={user}
        today={today}
      />
    </div>
  );
}

function DayDetail({
  selected,
  tasks,
  goals,
  doneHabits,
  user,
  today,
}: {
  selected: IsoDate;
  tasks: Task[];
  goals: Goal[];
  doneHabits: Set<string>;
  user: CurrentUser;
  today: IsoDate;
}) {
  const isToday = selected === today;
  // Hoje: todos os hábitos ativos (concluíveis). Outros dias: só os concluídos
  // naquele dia (read-only — o domínio registra execução para "hoje").
  const habitRows = isToday
    ? goals.map((g) => ({ goal: g, done: doneHabits.has(g.id) }))
    : goals.filter((g) => doneHabits.has(g.id)).map((g) => ({ goal: g, done: true }));

  return (
    <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {dayLabel(selected)}
        {isToday ? " · hoje" : ""}
      </h3>

      <p class="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Tarefas</p>
      {tasks.length === 0 ? (
        <p class="text-sm text-slate-500 dark:text-slate-400">Sem tarefas neste dia.</p>
      ) : (
        <ul class="flex flex-col gap-2">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} user={user} today={today} />
          ))}
        </ul>
      )}
      <AddOnDay user={user} date={selected} />

      {habitRows.length > 0 && (
        <div class="mt-4">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Hábitos</p>
          <ul class="flex flex-col gap-2">
            {habitRows.map(({ goal, done }) => (
              <HabitItem key={goal.id} goal={goal} done={done} canComplete={isToday} user={user} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HabitItem({
  goal,
  done,
  canComplete,
  user,
}: {
  goal: Goal;
  done: boolean;
  canComplete: boolean;
  user: CurrentUser;
}) {
  const complete = async () => {
    await container.logExecution.execute({
      goalId: goal.id,
      userId: user.id,
      timezone: user.timezone,
      clientEventId: crypto.randomUUID(),
    });
    void container.sync.flush();
  };
  return (
    <li class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p
        class={`min-w-0 truncate text-sm font-medium ${
          done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {goal.title}
      </p>
      {done ? (
        <span class="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ feito</span>
      ) : canComplete ? (
        <button
          onClick={() => void complete()}
          class="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
        >
          Concluir
        </button>
      ) : (
        <span class="shrink-0 text-xs text-slate-400 dark:text-slate-500">—</span>
      )}
    </li>
  );
}

function AddOnDay({ user, date }: { user: CurrentUser; date: IsoDate }) {
  const [title, setTitle] = useState("");
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!title.trim()) return;
    await container.createTask.execute({ userId: user.id, title, dueDate: date });
    setTitle("");
    void container.sync.flush();
  };
  return (
    <form onSubmit={submit} class="mt-3 flex gap-2">
      <input
        value={title}
        onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
        placeholder="+ nova tarefa nesta data"
        class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <button
        type="submit"
        class="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Add
      </button>
    </form>
  );
}

function AgendaView({ tasks, user, today }: { tasks: Task[]; user: CurrentUser; today: IsoDate }) {
  const tomorrow = addDays(today, 1);
  const byDate = (a: Task, b: Task) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  const dated = tasks.filter((t) => t.dueDate);

  const sections: Array<[string, Task[]]> = [
    ["Atrasadas", dated.filter((t) => t.dueDate! < today && t.status === "pending").sort(byDate)],
    ["Hoje", dated.filter((t) => t.dueDate === today).sort(byDate)],
    ["Amanhã", dated.filter((t) => t.dueDate === tomorrow).sort(byDate)],
    ["Próximos", dated.filter((t) => t.dueDate! > tomorrow).sort(byDate)],
    ["Sem data", tasks.filter((t) => !t.dueDate)],
  ];
  const visible = sections.filter(([, list]) => list.length > 0);

  if (visible.length === 0) {
    return (
      <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Nenhuma tarefa. Crie uma na aba Tarefas ou no Calendário (modo Mês).
      </p>
    );
  }

  return (
    <div class="flex flex-col gap-4">
      {visible.map(([title, list]) => (
        <section key={title}>
          <h3
            class={`mb-2 text-sm font-semibold ${
              title === "Atrasadas"
                ? "text-red-600 dark:text-red-400"
                : "text-slate-700 dark:text-slate-200"
            }`}
          >
            {title}
          </h3>
          <ul class="flex flex-col gap-2">
            {list.map((t) => (
              <TaskItem key={t.id} task={t} user={user} today={today} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TaskItem({ task, user, today }: { task: Task; user: CurrentUser; today: IsoDate }) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate != null && task.dueDate < today;

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
  const reschedule = async (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if (!value) return;
    await container.editTask.execute({ taskId: task.id, userId: user.id, dueDate: value });
    void container.sync.flush();
  };

  return (
    <li class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="min-w-0">
        <p
          class={`truncate text-sm font-medium ${
            done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-100"
          }`}
        >
          {task.title}
        </p>
        {overdue && <p class="text-xs font-medium text-red-600 dark:text-red-400">Atrasada</p>}
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <input
          type="date"
          value={task.dueDate ?? ""}
          onChange={(e) => void reschedule(e)}
          aria-label="Remarcar data"
          class="rounded-lg border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          onClick={() => void (done ? undo() : complete())}
          class={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
            done
              ? "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          {done ? "Desfazer" : "Concluir"}
        </button>
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

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: preact.ComponentChildren;
}) {
  return (
    <button
      onClick={onClick}
      class={`rounded-lg px-4 py-1.5 text-sm font-medium ${
        active
          ? "bg-brand text-white"
          : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
