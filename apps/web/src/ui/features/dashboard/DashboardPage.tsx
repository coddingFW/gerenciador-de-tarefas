import { useLiveQuery } from "dexie-react-hooks";
import { ProductivityScore, StreakCalculator, type ExecutionLog } from "@habit/core";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";

/** US-05/US-06: dashboard pessoal v0 — streaks, tempo e score (derivados dos logs). */
export function DashboardPage({ user }: { user: CurrentUser }) {
  const today = container.clock.today(user.timezone);

  const goals =
    useLiveQuery(
      () => localDB.goals.where("userId").equals(user.id).filter((g) => g.active).toArray(),
      [user.id],
    ) ?? [];

  const logs =
    useLiveQuery(
      () => localDB.executionLogs.where("userId").equals(user.id).toArray(),
      [user.id],
    ) ?? [];

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

      <section>
        <h2 class="mb-2 text-sm font-semibold text-slate-700">Por hábito</h2>
        {perGoal.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Sem dados ainda. Registre execuções na aba Hoje.
          </p>
        ) : (
          <ul class="flex flex-col gap-2">
            {perGoal.map(({ goal, streak, minutes, executions }) => (
              <li
                key={goal.id}
                class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-800">{goal.title}</p>
                  <p class="text-xs text-slate-500">
                    {executions} execuç{executions === 1 ? "ão" : "ões"} · {minutes} min
                  </p>
                </div>
                <div class="ml-3 shrink-0 text-right">
                  <p class="text-sm font-semibold text-slate-800">{streak.current}🔥</p>
                  <p class="text-xs text-slate-500">melhor {streak.best}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div class={`rounded-xl border p-3 shadow-sm ${accent ? "border-brand bg-brand/5" : "border-slate-200 bg-white"}`}>
      <p class="text-xs text-slate-500">{label}</p>
      <p class={`mt-1 text-xl font-bold ${accent ? "text-brand-dark" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
