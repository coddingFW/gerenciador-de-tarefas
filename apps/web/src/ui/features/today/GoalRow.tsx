import { useState } from "preact/hooks";
import type { Category, Goal, GoalFrequency } from "@habit/core";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import { ReminderControl } from "../reminders/ReminderControl";

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

/** Linha de hábito da tela Hoje: concluir, editar (inline) e arquivar. */
export function GoalRow({
  goal,
  done,
  user,
  categories,
  onComplete,
}: {
  goal: Goal;
  done: boolean;
  user: CurrentUser;
  categories: Category[];
  onComplete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  if (editing) {
    return <GoalEditor goal={goal} user={user} categories={categories} onClose={() => setEditing(false)} />;
  }

  const archive = async () => {
    await container.archiveGoal.execute({ goalId: goal.id, userId: user.id, archived: true });
    void container.sync.flush();
  };

  return (
    <li class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div class="flex items-center justify-between">
      <div class="min-w-0">
        <p class={`truncate text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>
          {goal.title}
        </p>
        <p class="text-xs text-slate-500">
          {FREQUENCY_LABEL[goal.frequency]}
          {goal.targetMinutes ? ` · meta ${goal.targetMinutes} min` : ""}
        </p>
      </div>
      <div class="ml-3 flex shrink-0 items-center gap-1">
        <button
          onClick={() => setShowReminder((v) => !v)}
          aria-label="Lembrete do hábito"
          aria-pressed={showReminder}
          class="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          🔔
        </button>
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar hábito"
          class="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✎
        </button>
        <button
          onClick={() => void archive()}
          aria-label="Arquivar hábito"
          class="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-red-600"
        >
          🗑
        </button>
        <button
          onClick={onComplete}
          disabled={done}
          class={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            done
              ? "cursor-default bg-emerald-100 text-emerald-700"
              : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          {done ? "✓ Feito" : "Concluir"}
        </button>
      </div>
      </div>
      {showReminder && (
        <ReminderControl goal={goal} user={user} onClose={() => setShowReminder(false)} />
      )}
    </li>
  );
}

/** Editor inline: título, frequência, meta de minutos e categoria. */
function GoalEditor({
  goal,
  user,
  categories,
  onClose,
}: {
  goal: Goal;
  user: CurrentUser;
  categories: Category[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [frequency, setFrequency] = useState<GoalFrequency>(goal.frequency);
  const [minutes, setMinutes] = useState(goal.targetMinutes?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(goal.categoryId ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await container.editGoal.execute({
        goalId: goal.id,
        userId: user.id,
        title,
        frequency,
        targetMinutes: minutes ? Number(minutes) : null,
        categoryId: categoryId || null,
      });
      void container.sync.flush();
      onClose();
    } catch {
      setError("Informe um título válido para o hábito.");
    }
  };

  return (
    <li class="rounded-xl border border-brand/40 bg-white p-3 shadow-sm">
      <form onSubmit={save} class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency((e.target as HTMLSelectElement).value as GoalFrequency)}
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="daily">Diário</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
        <input
          value={minutes}
          onInput={(e) => setMinutes((e.target as HTMLInputElement).value)}
          type="number"
          min="0"
          placeholder="min"
          class="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {categories.length > 0 && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}
            aria-label="Categoria"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div class="flex gap-1">
          <button
            type="submit"
            class="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={onClose}
            class="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </form>
      {error && <p class="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
