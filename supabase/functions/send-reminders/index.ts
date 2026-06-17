// send-reminders — Edge Function (Fase 2 P0).
//
// Dispara os Web Push dos lembretes que estão vencendo. Agendada pelo pg_cron a
// cada minuto (migration 0012, via _invoke_edge_function + Vault). O match
// temporal (fuso do usuário, janela, idempotência) é feito ATOMICAMENTE no banco
// pela função SQL `claim_due_reminders` (seleciona E marca last_sent_on) — ver
// ADR-0005. Esta função só lê os "due", busca as subscriptions e envia.
//
// Invocação server-only (service_role no header Authorization). NUNCA pelo cliente.
//   POST /functions/v1/send-reminders   Authorization: Bearer <SERVICE_ROLE_KEY>
//
// Secrets necessárias (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (ex.: "mailto:voce@dominio.com").

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

interface DueReminder {
  reminder_id: string;
  user_id: string;
  goal_id: string;
  goal_title: string | null;
}
interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!supabaseUrl || !serviceKey) return json(500, { error: "missing_server_env" });
  if (!vapidPublic || !vapidPrivate) return json(500, { error: "missing_vapid_env" });

  // Guarda: só a service_role dispara o job (impede chamada de cliente autenticado).
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token !== serviceKey) return json(401, { error: "unauthorized" });

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1) Reivindica (seleciona + marca) os lembretes vencendo — atômico no banco.
  const { data: due, error: dueErr } = await admin.rpc("claim_due_reminders", {});
  if (dueErr) return json(500, { error: dueErr.message });
  const reminders = (due ?? []) as DueReminder[];
  if (reminders.length === 0) return json(200, { dueCount: 0, sent: 0, failed: 0 });

  // 2) Para cada lembrete, busca as subscriptions do usuário e envia (concorrente).
  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  for (const r of reminders) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", r.user_id);

    const payload = JSON.stringify({
      title: r.goal_title ?? "Habit Tracker",
      body: "Hora de cuidar desse hábito. 💪",
      url: "/",
    });

    const results = await Promise.allSettled(
      ((subs ?? []) as Subscription[]).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        ),
      ),
    );

    results.forEach((res, i) => {
      if (res.status === "fulfilled") {
        sent += 1;
      } else {
        failed += 1;
        // 404/410 = subscription morta: marca para limpeza.
        const status = (res.reason as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          const ep = ((subs ?? []) as Subscription[])[i]?.endpoint;
          if (ep) staleEndpoints.push(ep);
        }
      }
    });
  }

  // 3) Limpa subscriptions inválidas.
  if (staleEndpoints.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return json(failed > 0 ? 207 : 200, {
    dueCount: reminders.length,
    sent,
    failed,
    cleaned: staleEndpoints.length,
  });
});
