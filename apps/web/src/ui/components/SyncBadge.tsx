import { useSyncStatus } from "../hooks/useSyncStatus";

/** Indicador de conectividade e fila de sincronização (offline-first). */
export function SyncBadge() {
  const { online, pending, syncing, backend } = useSyncStatus();

  const label = !online
    ? "Offline"
    : !backend
      ? "Local"
      : syncing
        ? "Sincronizando…"
        : pending > 0
          ? `${pending} pendente${pending > 1 ? "s" : ""}`
          : "Sincronizado";

  const color = !online
    ? "bg-amber-100 text-amber-800"
    : backend && (pending > 0 || syncing)
      ? "bg-sky-100 text-sky-800"
      : "bg-emerald-100 text-emerald-800";

  return (
    <span class={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      <span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />
      {label}
    </span>
  );
}
