import { useEffect, useState } from "preact/hooks";
import { isBackendConfigured, supabase } from "../infrastructure/supabase/client";

export interface CurrentUser {
  id: string;
  name: string;
  timezone: string;
}

const DEMO_KEY = "habit.demoUserId";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Usuário de demonstração (modo local-first sem backend), estável entre sessões. */
function demoUser(): CurrentUser {
  let id = localStorage.getItem(DEMO_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEMO_KEY, id);
  }
  return { id, name: "Você (demo)", timezone: browserTimezone() };
}

export interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  backend: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Autenticação (Fase 1 §7.1). Com Supabase configurado, usa Google OAuth; caso
 * contrário, entra automaticamente como usuário de demonstração local.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBackendConfigured || !supabase) {
      setUser(demoUser());
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setUser(mapUser(data.session?.user));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async (): Promise<void> => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, backend: isBackendConfigured, signInWithGoogle, signOut };
}

function mapUser(u: { id: string; user_metadata?: Record<string, unknown> } | undefined | null): CurrentUser | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const name = (meta.full_name as string) || (meta.name as string) || "Usuário";
  return { id: u.id, name, timezone: browserTimezone() };
}
