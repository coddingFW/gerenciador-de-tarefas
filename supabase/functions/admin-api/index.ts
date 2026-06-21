// admin-api — Edge Function (Fase 1 §9/§12).
//
// Backend do painel ADMIN. Diferente de recompute-metrics/event-dispatcher
// (server-to-server com service_role), esta função é chamada pelo BROWSER de um
// admin: autentica pelo JWT do usuário e exige `profiles.role = 'admin'`. Só
// então usa o service_role para ler as views administrativas (que são revogadas
// de `authenticated`) e gravar auditoria.
//
//   GET  /functions/v1/admin-api            → visão geral (métricas + flags)
//   POST /functions/v1/admin-api            → { action: "set-flag", key, patch }
//   Authorization: Bearer <ACCESS_TOKEN do usuário>
//
// Toda ação de escrita grava em audit_logs (regra inviolável #3).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

const FLAG_FIELDS = [
  "enabled_global",
  "rollout_percentage",
  "enabled_for_roles",
  "enabled_for_plans",
  "enabled_for_users",
] as const;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "missing_server_env" });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "missing_token" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Resolve o usuário a partir do JWT e exige role admin.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: "unauthorized" });

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profErr) return json(500, { error: profErr.message });
  if (profile?.role !== "admin") return json(403, { error: "forbidden" });

  const userId = userData.user.id;

  // 2. Roteamento.
  if (req.method === "GET") {
    const [totalUsers, dau, active, completion, topHabits, retention, flags] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("v_dau").select("day, dau").order("day", { ascending: false }).limit(30),
      admin.from("v_active_users").select("wau, mau").maybeSingle(),
      admin.from("v_completion_rate").select("completion_rate").maybeSingle(),
      admin.from("v_top_habits").select("habit, executions").limit(10),
      admin
        .from("mv_retention_cohort")
        .select("cohort_week, cohort_size, retained_d7")
        .order("cohort_week", { ascending: false })
        .limit(12),
      admin.from("feature_flags").select("*").order("key"),
    ]);

    const firstError = [totalUsers, dau, active, completion, topHabits, retention, flags].find(
      (r) => r.error,
    );
    if (firstError?.error) return json(500, { error: firstError.error.message });

    return json(200, {
      metrics: {
        totalUsers: totalUsers.count ?? 0,
        dau: dau.data,
        wau: active.data?.wau ?? 0,
        mau: active.data?.mau ?? 0,
        completionRate: completion.data?.completion_rate ?? null,
        topHabits: topHabits.data,
        retention: retention.data,
      },
      flags: flags.data,
    });
  }

  if (req.method === "POST") {
    let body: { action?: string; key?: string; patch?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid_json" });
    }

    if (body.action !== "set-flag" || !body.key || !body.patch) {
      return json(400, { error: "invalid_request" });
    }

    // Só campos permitidos (nunca `key`/`id`).
    const patch: Record<string, unknown> = {};
    for (const f of FLAG_FIELDS) {
      if (f in body.patch) patch[f] = body.patch[f];
    }
    if (Object.keys(patch).length === 0) return json(400, { error: "empty_patch" });
    patch.updated_by = userId;
    patch.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await admin
      .from("feature_flags")
      .update(patch)
      .eq("key", body.key)
      .select()
      .maybeSingle();
    if (updErr) return json(500, { error: updErr.message });
    if (!updated) return json(404, { error: "flag_not_found" });

    // Auditoria (regra inviolável #3).
    await admin.from("audit_logs").insert({
      actor_id: userId,
      actor_role: "admin",
      action: "feature_flag.update",
      target_resource: "feature_flags",
      target_id: updated.id,
      metadata: { key: body.key, patch },
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { flag: updated });
  }

  return json(405, { error: "method_not_allowed" });
});
