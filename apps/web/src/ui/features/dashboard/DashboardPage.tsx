import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import {
  HistoryAggregator,
  ProductivityScore,
  StreakCalculator,
  type ExecutionLog,
} from "@habit/core";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import { HistoryChart } from "./HistoryChart";

/** US-05/US-06: dashboard pessoal — hoje + histórico (derivados dos logs locais). */
export function DashboardPage({ user }: { user: CurrentUser }) {
  const today = container.clock.today(user.timezone);

  const goals =
    useLiveQuery(
      () => localDB.goals.where("userId").equals(user.id).filter((g) => g.active).toArray(),
      [user.id],
    ) ?? [];

  const logsRaw = useLiveQuery(
    () => localDB.executionLogs.where("userId").equals(user.id).toArray(),
    [user.id],
  );
  const logs = logsRaw ?? [];

  const logsByGoal = new Map<string, ExecutionLog[]>();
  for (const l of logs) {
    if (!l.goalId) continue;
    const list = logsByGoal.get(l.goalId) ?? [];
    list.push(l);
    logsByGoal.set(l.goalId, list);
  }

  const perGoal = goals.map((g) => {
    const gLogs = logsByGoal.get(g.id) ?? [];
    const streak = StreakCalculator.computeDaily(gLogs, today);
    const minutes = gLogs.reduce((sum, l) => sum + l.minutesSpent, 0);
    return { goal: g, streak, minutes, executions: gLogs.length };
  });

  const doneToday = new Set(logs.filter((l) => l.occurredOn === today).map((l) => l.goalId)).size;
  const completionRate = goals.length > 0 ? doneToday / goals.length : 0;
  const bestStreak = perGoal.reduce((max, p) => Math.max(max, p.streak.current), 0);
  const totalMinutes = perGoal.reduce((sum, p) => sum + p.minutes, 0);
  const targetMinutes = goals.reduce((sum, g) => sum + (g.targetMinutes ?? 0), 0);

  const score = ProductivityScore.compute({
    completionRate,
    adherence: completionRate,
    minutesSpent: totalMinutes,
    targetMinutes: targetMinutes || null,
    streakCount: bestStreak,
  });

  return (
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Score hoje" value={String(score)} accent />
        <Stat label="Conclusão" value={`${Math.round(completionRate * 100)}%`} />
        <Stat label="Maior streak" value={`${bestStreak}🔥`} />
        <Stat label="Tempo total" value={`${totalMinutes} min`} />
      </div>

      <HistorySection logs={logsRaw} today={today} />

      <section>
        <h2 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Por hábito</h2>
        {perGoal.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Sem dados ainda. Registre execuções na aba Hoje.
          </p>
        ) : (
          <ul class="flex flex-col gap-2">
            {perGoal.map(({ goal, streak, minutes, executions }) => (
              <li
                key={goal.id}
                class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{goal.title}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {executions} execuç{executions === 1 ? "ão" : "ões"} · {minutes} min
                  </p>
                </div>
                <div class="ml-3 shrink-0 text-right">
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{streak.current}🔥</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">melhor {streak.best}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HistorySection({ logs, today }: { logs: ExecutionLog[] | undefined; today: string }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [metric, setMetric] = useState<"executions" | "minutes">("executions");

  return (
    <section>
      <div class="mb-2 flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Histórico</h2>
        <div class="flex items-center gap-1">
          <Toggle active={metric === "executions"} onClick={() => setMetric("executions")}>
            Execuções
          </Toggle>
          <Toggle active={metric === "minutes"} onClick={() => setMetric("minutes")}>
            Minutos
          </Toggle>
          <span class="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <Toggle active={period === 7} onClick={() => setPeriod(7)}>
            7d
          </Toggle>
          <Toggle active={period === 30} onClick={() => setPeriod(30)}>
            30d
          </Toggle>
        </div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <HistoryBody logs={logs} today={today} period={period} metric={metric} />
      </div>
    </section>
  );
}

function HistoryBody({
  logs,
  today,
  period,
  metric,
}: {
  logs: ExecutionLog[] | undefined;
  today: string;
  period: 7 | 30;
  metric: "executions" | "minutes";
}) {
  if (logs === undefined) {
    return <div class="h-32 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />;
  }
  if (logs.length === 0) {
    return (
      <p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Sem dados ainda. Registre execuções na aba Hoje.
      </p>
    );
  }

  try {
    const series = HistoryAggregator.daily(logs, period, today);
    const activeDays = series.filter((p) => p.executions > 0).length;
    const totalExec = series.reduce((s, p) => s + p.executions, 0);
    const totalMin = series.reduce((s, p) => s + p.minutes, 0);

    return (
      <div class="flex flex-col gap-2">
        <HistoryChart data={series} metric={metric} />
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {totalExec} execuç{totalExec === 1 ? "ão" : "ões"} · {totalMin} min
          </span>
          {activeDays < 2 && <span class="text-amber-600 dark:text-amber-400">Dados insuficientes para tendência</span>}
        </div>
      </div>
    );
  } catch {
    return (
      <p class="py-8 text-center text-sm text-red-600 dark:text-red-400">
        Não foi possível carregar o histórico. Tente novamente.
      </p>
    );
  }
}

function Toggle({
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
      class={`rounded-md px-2 py-1 text-xs font-medium ${
        active ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div class={`rounded-xl border p-3 shadow-sm ${accent ? "border-brand bg-brand/5 dark:bg-brand/10" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
      <p class="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p class={`mt-1 text-xl font-bold ${accent ? "text-brand-dark dark:text-brand" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}
