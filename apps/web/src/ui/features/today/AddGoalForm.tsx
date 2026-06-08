import { useState } from "preact/hooks";
import type { GoalFrequency } from "@habit/core";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";

/** US-02: criar um hábito. Validação leve no cliente; o domínio valida de novo. */
export function AddGoalForm({ user }: { user: CurrentUser }) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<GoalFrequency>("daily");
  const [minutes, setMinutes] = useState("");
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
      });
      setTitle("");
      setMinutes("");
      void container.sync.flush();
    } catch {
      setError("Informe um título válido para o hábito.");
    }
  };

  return (
    <form onSubmit={submit} class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="mb-3 text-sm font-semibold text-slate-700">Novo hábito</h2>
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          placeholder="Ex.: Ler 10 páginas"
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
