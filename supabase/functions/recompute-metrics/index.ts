// recompute-metrics — Edge Function (Fase 1 §8 / §15).
//
// Job de agregação SERVER-SIDE. A derivação de streak já é garantida de forma
// transacional pelo trigger trg_execution_logs_streak; esta função cobre o que
// um trigger por-linha não resolve bem:
//   • backfill / reconciliação periódica das streaks (recompute_user_streaks)
//   • score diário de produtividade por usuário (compute_daily_score)
//   • refresh da matview de retenção (refresh_metrics_views)
//
// Invocação (server-to-server): apenas com a SERVICE_ROLE_KEY no header
// Authorization. Pensada para ser chamada por um cron (pg_cron / scheduler) ou
// pelo event-dispatcher. NUNCA deve ser chamada pelo cliente.
//
//   POST /functions/v1/recompute-metrics
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   { "userId"?: string, "day"?: "YYYY-MM-DD" }   // ambos opcionais
//
// Sem userId → processa todos os profiles. Sem day → usa a data corrente (UTC).

import { createClient } from "jsr:@supabase/supabase-js@2";

interface Body {
  userId?: string;
  day?: string;
}

interface UserResult {
  userId: string;
  streaksRecomputed: number;
  dailyScore: number | null;
  error?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "missing_server_env" });
  }

  // Guarda: só aceita a service_role key. Impede que um cliente autenticado
  // (anon/usuário) dispare jobs administrativos.
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== serviceKey) {
    return json(401, { error: "unauthorized" });
  }

  let body: Body = {};
  try {
    if (req.headers.get("content-length") !== "0" && req.body) {
      body = (await req.json()) as Body;
    }
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const day = body.day ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return json(400, { error: "invalid_day" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Universo de usuários a processar.
  let userIds: string[];
  if (body.userId) {
    userIds = [body.userId];
  } else {
    const { data, error } = await admin.from("profiles").select("id");
    if (error) return json(500, { error: error.message });
    userIds = (data ?? []).map((r: { id: string }) => r.id);
  }

  const results: UserResult[] = [];
  for (const userId of userIds) {
    const result: UserResult = { userId, streaksRecomputed: 0, dailyScore: null };
    try {
      const streaks = await admin.rpc("recompute_user_streaks", { p_user_id: userId });
      if (streaks.error) throw streaks.error;
      result.streaksRecomputed = (streaks.data as number) ?? 0;

      const score = await admin.rpc("compute_daily_score", { p_user_id: userId, p_day: day });
      if (score.error) throw score.error;
      result.dailyScore = (score.data as number) ?? null;
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
    }
    results.push(result);
  }

  // Refresh das views agregadas (best-effort: não derruba o job se falhar).
  const refresh = await admin.rpc("refresh_metrics_views");
  const viewsRefreshed = !refresh.error;

  const failed = results.filter((r) => r.error).length;
  return json(failed > 0 ? 207 : 200, {
    day,
    usersProcessed: results.length,
    failed,
    viewsRefreshed,
    results,
  });
});
