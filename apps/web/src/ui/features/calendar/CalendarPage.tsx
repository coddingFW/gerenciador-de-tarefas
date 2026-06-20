import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import type { IsoDate, Task } from "@habit/core";
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

const HEAT = [
  "",
  "bg-emerald-100 dark:bg-emerald-900/40",
  "bg-emerald-200 dark:bg-emerald-800/50",
  "bg-emerald-300 dark:bg-emerald-700/60",
];
const heatLevel = (n: number): number => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3);

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

  const tasksByDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const list = tasksByDate.get(t.dueDate) ?? [];
    list.push(t);
    tasksByDate.set(t.dueDate, list);
  }
  const habitByDate = new Map<string, number>();
  for (const l of logs) habitByDate.set(l.occurredOn, (habitByDate.get(l.occurredOn) ?? 0) + 1);

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
          habitByDate={habitByDate}
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
  habitByDate,
  user,
}: {
  view: { y: number; m: number };
  setView: (v: { y: number; m: number }) => void;
  today: IsoDate;
  selected: IsoDate;
  setSelected: (d: IsoDate) => void;
  tasksByDate: Map<string, Task[]>;
  habitByDate: Map<string, number>;
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
          const level = heatLevel(habitByDate.get(dIso) ?? 0);
          const isToday = dIso === today;
          const isSel = dIso === selected;
          const overdue = dIso < today && dayTasks.some((t) => t.status === "pending");
          const base = isSel
            ? "bg-brand text-white"
            : `${HEAT[level]} ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}`;
          return (
            <button
              key={dIso}
              onClick={() => setSelected(dIso)}
              aria-label={dayLabel(dIso)}
              aria-pressed={isSel}
              class={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm ${base} ${
                isToday && !isSel ? "ring-2 ring-brand" : ""
              }`}
            >
              <span>{d}</span>
              <span class="flex h-1.5 items-center gap-0.5">
                {dayTasks.slice(0, 3).map((t, j) => (
                  <span
                    key={j}
                    class={`h-1.5 w-1.5 rounded-full ${
                      isSel ? "bg-white" : t.status === "done" ? "bg-emerald-500" : "bg-brand"
                    }`}
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
        user={user}
        today={today}
      />
    </div>
  );
}

function DayDetail({
  selected,
  tasks,
  user,
  today,
}: {
  selected: IsoDate;
  tasks: Task[];
  user: CurrentUser;
  today: IsoDate;
}) {
  return (
    <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {dayLabel(selected)}
        {selected === today ? " · hoje" : ""}
      </h3>
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
    </div>
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
