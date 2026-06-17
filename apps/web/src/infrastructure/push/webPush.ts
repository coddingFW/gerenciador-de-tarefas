import { localDB } from "../persistence/db";

/**
 * Web Push no cliente (Fase 2). Pede permissão, cria a subscription com a chave
 * VAPID pública e persiste no Dexie (`_sync = 0`) para o SyncEngine enviar ao
 * Supabase. O envio em si é server-side (Edge Function). No iOS, Web Push exige
 * o PWA instalado na tela de início (iOS 16.4+) — detectado por `needs-install`.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIOS(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** PWA aberto em modo standalone (instalado) — pré-requisito de push no iOS. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mql || iosStandalone;
}

export type EnablePushResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "needs-install" | "denied" | "no-key" | "error" };

export async function enablePushForUser(userId: string): Promise<EnablePushResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (isIOS() && !isStandalone()) return { ok: false, reason: "needs-install" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-key" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));
    await saveSubscription(userId, sub);
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

async function saveSubscription(userId: string, sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return;
  const existing = await localDB.pushSubscriptions.where("endpoint").equals(endpoint).first();
  await localDB.pushSubscriptions.put({
    id: existing?.id ?? crypto.randomUUID(),
    userId,
    endpoint,
    p256dh,
    auth,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    _sync: 0,
  });
}

/** Converte a VAPID public key (base64url) para o formato que o PushManager espera. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
