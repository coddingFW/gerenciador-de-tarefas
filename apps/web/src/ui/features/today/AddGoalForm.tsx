import { useState } from "preact/hooks";
import type { Category, GoalFrequency } from "@habit/core";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";

/** US-02: criar um hábito. Validação leve no cliente; o domínio valida de novo. */
export function AddGoalForm({ user, categories }: { user: CurrentUser; categories: Category[] }) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<GoalFrequency>("daily");
  const [minutes, setMinutes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await container.createGoal.execute({
        userId: user.id,
        title,
        frequency,
        targetCount: 1,
        targetMinutes: minutes ? Number(minutes) : null,
        categoryId: categoryId || null,
      });
      setTitle("");
      setMinutes("");
      setCategoryId("");
      void container.sync.flush();
    } catch {
      setError("Informe um título válido para o hábito.");
    }
  };

  return (
    <form onSubmit={submit} class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Novo hábito</h2>
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          placeholder="Ex.: Ler 10 páginas"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency((e.target as HTMLSelectElement).value as GoalFrequency)}
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
        <button
          type="submit"
          class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Adicionar
        </button>
      </div>
      {categories.length > 0 && (
        <select
          value={categoryId}
          onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}
          aria-label="Categoria"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
      {error && <p class="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
