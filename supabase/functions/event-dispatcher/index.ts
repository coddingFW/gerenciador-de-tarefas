// event-dispatcher — Edge Function (Fase 1 §6).
//
// Consome o outbox `domain_events` (produzido transacionalmente pelos triggers
// da migration 0007) e encaminha cada evento aos consumidores. Consumidor do
// MVP = MÉTRICAS: recalcula o score diário (compute_daily_score) do usuário/dia
// afetado. A streak já é derivada pelo seu próprio trigger; aqui fechamos o
// score de forma assíncrona e desacoplada do caminho de escrita.
//
// Entrega at-least-once: lê pendentes → executa efeitos (idempotentes, upsert)
// → marca processed_at. Reprocessar é seguro.
//
//   POST /functions/v1/event-dispatcher
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   { "limit"?: number }   // tamanho do lote (padrão 200)

import { createClient } from "jsr:@supabase/supabase-js@2";

interface DomainEventRow {
  id: string;
  event_type: string;
  user_id: string | null;
  payload: Record<string, unknown>;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Dia (no fuso do usuário) que o evento afeta para fins de score. */
function affectedDay(ev: DomainEventRow): string {
  const p = ev.payload ?? {};
  switch (ev.event_type) {
    case "ExecutionLogged":
      return (p.occurred_on as string) ?? todayUtc();
    case "TaskCompleted":
      return (p.due_date as string) ?? todayUtc();
    case "GoalCreated":
    case "GoalUpdated":
    case "GoalArchived":
      return todayUtc(); // muda o denominador/alvo de aderência de hoje
    default:
      return todayUtc();
  }
}

/** Eventos que disparam recálculo de score. */
const SCORING_EVENTS = new Set([
  "ExecutionLogged",
  "TaskCompleted",
  "GoalCreated",
  "GoalUpdated",
  "GoalArchived",
]);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "missing_server_env" });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token !== serviceKey) return json(401, { error: "unauthorized" });

  let limit = 200;
  try {
    if (req.headers.get("content-length") !== "0" && req.body) {
      const body = (await req.json()) as { limit?: number };
      if (typeof body.limit === "number" && body.limit > 0) limit = Math.min(body.limit, 1000);
    }
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Lê o lote de pendentes (mais antigos primeiro).
  const { data: events, error } = await admin
    .from("domain_events")
    .select("id, event_type, user_id, payload")
    .is("processed_at", null)
    .order("occurred_at", { ascending: true })
    .limit(limit);
  if (error) return json(500, { error: error.message });

  const rows = (events ?? []) as DomainEventRow[];
  if (rows.length === 0) return json(200, { processed: 0, scoresRecomputed: 0 });

  // 2. Coalesce: um único recompute por (usuário, dia) afetado.
  const recomputeKeys = new Map<string, { userId: string; day: string }>();
  for (const ev of rows) {
    if (!ev.user_id || !SCORING_EVENTS.has(ev.event_type)) continue;
    const day = affectedDay(ev);
    recomputeKeys.set(`${ev.user_id}|${day}`, { userId: ev.user_id, day });
  }

  // 3. Executa os efeitos (idempotentes).
  let scoresRecomputed = 0;
  const failures: Array<{ userId: string; day: string; error: string }> = [];
  for (const { userId, day } of recomputeKeys.values()) {
    const { error: rpcErr } = await admin.rpc("compute_daily_score", {
      p_user_id: userId,
      p_day: day,
    });
    if (rpcErr) failures.push({ userId, day, error: rpcErr.message });
    else scoresRecomputed++;
  }

  // 4. Marca como processados apenas se não houve falha de efeito (senão deixa
  //    pendente para a próxima rodada — at-least-once).
  let processed = 0;
  if (failures.length === 0) {
    const ids = rows.map((r) => r.id);
    const { data: marked, error: markErr } = await admin.rpc("mark_events_processed", {
      p_ids: ids,
    });
    if (markErr) return json(500, { error: markErr.message, scoresRecomputed });
    processed = (marked as number) ?? 0;
  }

  return json(failures.length > 0 ? 207 : 200, {
    read: rows.length,
    processed,
    scoresRecomputed,
    failures,
  });
});
