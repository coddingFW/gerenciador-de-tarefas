import { useEffect, useState } from "preact/hooks";
import { container } from "../../lib/container";
import type { SyncStatus } from "../../infrastructure/sync/SyncEngine";

/** Assina o status do SyncEngine para a barra superior (online, pendentes…). */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    online: true,
    pending: 0,
    syncing: false,
    lastSyncAt: null,
    backend: false,
  });

  useEffect(() => container.sync.subscribe(setStatus), []);
  return status;
}
