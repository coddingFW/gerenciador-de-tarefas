import { useEffect, useState } from "preact/hooks";
import { supabase } from "../../../infrastructure/supabase/client";

interface AdminMetrics {
  totalUsers: number;
  dau: Array<{ day: string; dau: number }>;
  wau: number;
  mau: number;
  completionRate: number | null;
  topHabits: Array<{ habit: string; executions: number }>;
}

type LoadState =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error"; message: string }
  | { status: "ok"; metrics: AdminMetrics };

/** Painel admin (Fase 1 §9/§12): números globais via Edge Function `admin-api`,
 *  que já exige `profiles.role = 'admin'` no servidor — esta tela não decide
 *  permissão, só reflete o que o backend autoriza. */
export function AdminPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setState({ status: "loading" });
    if (!supabase) {
      setState({ status: "error", message: "Backend não configurado (modo demo local)." });
      return;
    }
    const { data, error } = await supabase.functions.invoke<{ metrics: AdminMetrics }>("admin-api", {
      method: "GET",
    });
    if (error) {
      const status = (error as { context?: Response }).context?.status;
      if (status === 403) setState({ status: "forbidden" });
      else setState({ status: "error", message: error.message });
      return;
    }
    if (!data) {
      setState({ status: "error", message: "Resposta vazia do servidor." });
      return;
    }
    setState({ status: "ok", metrics: data.metrics });
  }

  if (state.status === "loading") {
    return <p class="text-sm text-slate-500 dark:text-slate-400">Carregando métricas…</p>;
  }
  if (state.status === "forbidden") {
    return (
      <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Sua conta não tem permissão de administrador para ver estes números.
      </p>
    );
  }
  if (state.status === "error") {
    return <p class="text-sm text-red-600 dark:text-red-400">Erro ao carregar: {state.message}</p>;
  }

  const { metrics } = state;

  return (
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Contas criadas" value={String(metrics.totalUsers)} accent />
        <Stat label="Ativos hoje (DAU)" value={String(metrics.dau[0]?.dau ?? 0)} />
        <Stat label="Ativos na semana (WAU)" value={String(metrics.wau)} />
        <Stat label="Ativos no mês (MAU)" value={String(metrics.mau)} />
      </div>

      <section>
        <h2 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">DAU — últimos 30 dias</h2>
        {metrics.dau.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Sem execuções registradas ainda.
          </p>
        ) : (
          <ul class="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {metrics.dau.map((d) => (
              <li key={d.day} class="flex items-center justify-between text-sm">
                <span class="text-slate-500 dark:text-slate-400">{d.day}</span>
                <span class="font-medium text-slate-800 dark:text-slate-100">{d.dau}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Hábitos mais usados</h2>
        {metrics.topHabits.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Sem dados ainda.
          </p>
        ) : (
          <ul class="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {metrics.topHabits.map((h) => (
              <li key={h.habit} class="flex items-center justify-between text-sm">
                <span class="truncate text-slate-700 dark:text-slate-200">{h.habit}</span>
                <span class="font-medium text-slate-800 dark:text-slate-100">{h.executions}</span>
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
    <div class={`rounded-xl border p-3 shadow-sm ${accent ? "border-brand bg-brand/5 dark:bg-brand/10" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
      <p class="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p class={`mt-1 text-xl font-bold ${accent ? "text-brand-dark dark:text-brand" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}
