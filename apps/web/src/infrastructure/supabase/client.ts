import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Cliente Supabase — criado SOMENTE com a anon key (a service_role nunca vai ao
 * bundle, Fase 1 §7.2). Se as variáveis não estiverem configuradas, o app roda
 * em modo local-first puro (IndexedDB), sem backend.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

export const isBackendConfigured = supabase !== null;
