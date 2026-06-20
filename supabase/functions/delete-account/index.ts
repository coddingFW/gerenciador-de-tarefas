// delete-account — exclusão de conta do PRÓPRIO usuário (LGPD: direito ao
// esquecimento). O usuário chama com o seu JWT; a função identifica o userId por
// esse token e deleta o usuário via service_role. As FKs `on delete cascade`
// (auth.users) apagam profiles, goals, tasks, categories, execution_logs,
// reminders, push_subscriptions e streaks. domain_events (server-only) é limpo
// antes, best-effort.
//
//   POST /functions/v1/delete-account
//   Authorization: Bearer <USER_ACCESS_TOKEN>

import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "missing_server_env" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "missing_token" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Identidade vem do PRÓPRIO token — o usuário só pode excluir a si mesmo.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: "invalid_token" });
  const userId = userData.user.id;

  // Outbox server-only (sem cascade garantido) — best-effort.
  await admin.from("domain_events").delete().eq("user_id", userId);

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json(500, { error: delErr.message });

  return json(200, { deleted: true });
});
