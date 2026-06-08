import { useLiveQuery } from "dexie-react-hooks";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import { AddGoalForm } from "./AddGoalForm";

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

/** US-03/US-04: tela do dia. Conclusão em 1 toque, otimista e offline. */
export function TodayPage({ user }: { user: CurrentUser }) {
  const today = container.clock.today(user.timezone);

  const goals =
    useLiveQuery(
      () => localDB.goals.where("userId").equals(user.id).filter((g) => g.active).toArray(),
      [user.id],
    ) ?? [];

  const doneToday =
    useLiveQuery(
      () =>
        localDB.executionLogs
          .where("userId")
          .equals(user.id)
          .filter((l) => l.occurredOn === today)
          .toArray(),
      [user.id, today],
    ) ?? [];

  const doneGoalIds = new Set(doneToday.map((l) => l.goalId));

  const complete = async (goalId: string) => {
    await container.logExecution.execute({
      goalId,
      userId: user.id,
      timezone: user.timezone,
      clientEventId: crypto.randomUUID(),
    });
    void container.sync.flush();
  };

  return (
    <div class="flex flex-col gap-4">
      <AddGoalForm user={user} />

      <section>
        <div class="mb-2 flex items-baseline justify-between">
          <h2 class="text-sm font-semibold text-slate-700">Hoje</h2>
          <span class="text-xs text-slate-500">
            {doneGoalIds.size}/{goals.length} concluídos
          </span>
        </div>

        {goals.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nenhum hábito ainda. Crie o primeiro acima 👆
          </p>
        ) : (
          <ul class="flex flex-col gap-2">
            {goals.map((g) => {
              const done = doneGoalIds.has(g.id);
              return (
                <li
                  key={g.id}
                  class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div class="min-w-0">
                    <p class={`truncate text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {g.title}
                    </p>
                    <p class="text-xs text-slate-500">
                      {FREQUENCY_LABEL[g.frequency]}
                      {g.targetMinutes ? ` · meta ${g.targetMinutes} min` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => void complete(g.id)}
                    disabled={done}
                    class={`ml-3 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                      done
                        ? "cursor-default bg-emerald-100 text-emerald-700"
                        : "bg-brand text-white hover:bg-brand-dark"
                    }`}
                  >
                    {done ? "✓ Feito" : "Concluir"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
