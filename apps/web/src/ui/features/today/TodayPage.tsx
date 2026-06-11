import { useLiveQuery } from "dexie-react-hooks";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import { AddGoalForm } from "./AddGoalForm";
import { GoalRow } from "./GoalRow";

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
            {goals.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                done={doneGoalIds.has(g.id)}
                user={user}
                onComplete={() => void complete(g.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
