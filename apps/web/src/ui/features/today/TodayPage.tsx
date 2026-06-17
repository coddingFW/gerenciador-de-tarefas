import { useLiveQuery } from "dexie-react-hooks";
import type { Category, Goal } from "@habit/core";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import { CategoryBadge } from "../categories/CategoryBadge";
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

  const categories =
    useLiveQuery(
      () =>
        localDB.categories
          .where("userId")
          .equals(user.id)
          .filter((c) => !c.archived)
          .sortBy("sortOrder"),
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

  const groups = groupByCategory(goals, categories);

  return (
    <div class="flex flex-col gap-4">
      <AddGoalForm user={user} categories={categories} />

      <section>
        <div class="mb-2 flex items-baseline justify-between">
          <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Hoje</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400">
            {doneGoalIds.size}/{goals.length} concluídos
          </span>
        </div>

        {goals.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhum hábito ainda. Crie o primeiro acima 👆
          </p>
        ) : (
          <div class="flex flex-col gap-4">
            {groups.map(({ category, items }) => (
              <div key={category?.id ?? "none"}>
                <h3 class="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {category ? (
                    <CategoryBadge category={category} />
                  ) : (
                    "Sem categoria"
                  )}
                </h3>
                <ul class="flex flex-col gap-2">
                  {items.map((g) => (
                    <GoalRow
                      key={g.id}
                      goal={g}
                      done={doneGoalIds.has(g.id)}
                      user={user}
                      categories={categories}
                      onComplete={() => void complete(g.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Agrupa hábitos por categoria (na ordem das categorias), com "Sem categoria" ao fim. */
function groupByCategory(
  goals: Goal[],
  categories: Category[],
): Array<{ category: Category | null; items: Goal[] }> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, Goal[]>();
  const noCategory: Goal[] = [];

  for (const g of goals) {
    if (g.categoryId && byId.has(g.categoryId)) {
      const list = buckets.get(g.categoryId) ?? [];
      list.push(g);
      buckets.set(g.categoryId, list);
    } else {
      noCategory.push(g);
    }
  }

  const groups = categories
    .filter((c) => buckets.has(c.id))
    .map((c) => ({ category: c as Category | null, items: buckets.get(c.id)! }));

  if (noCategory.length > 0) groups.push({ category: null, items: noCategory });
  return groups;
}
