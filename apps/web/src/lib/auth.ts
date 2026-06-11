import { useEffect, useState } from "preact/hooks";
import { isBackendConfigured, supabase } from "../infrastructure/supabase/client";
import { container } from "./container";

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

/** Identidade do usuário de demonstração (modo local-first), estável entre sessões. */
function demoIdentity(): { id: string; name: string } {
  let id = localStorage.getItem(DEMO_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEMO_KEY, id);
  }
  return { id, name: "Você (demo)" };
}

/**
 * Captura SILENCIOSA do fuso: persiste o timezone do navegador no perfil (uma vez
 * por mudança) e devolve o `CurrentUser` com o fuso efetivo — fonte da verdade
 * dos cálculos de data (streak/score), inclusive no servidor. Idempotente.
 */
async function resolveUser(base: { id: string; name: string }): Promise<CurrentUser> {
  let timezone = browserTimezone();
  try {
    timezone = await container.syncUserTimezone.execute({
      userId: base.id,
      browserTimezone: timezone,
    });
    void container.sync.flush();
  } catch {
    // Falha ao persistir não bloqueia o login: segue com o fuso do navegador.
  }
  return { ...base, name: base.name, timezone };
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
      void resolveUser(demoIdentity()).then(setUser).finally(() => setLoading(false));
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      const identity = mapIdentity(data.session?.user);
      setUser(identity ? await resolveUser(identity) : null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const identity = mapIdentity(session?.user);
      setUser(identity ? await resolveUser(identity) : null);
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

function mapIdentity(
  u: { id: string; user_metadata?: Record<string, unknown> } | undefined | null,
): { id: string; name: string } | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const name = (meta.full_name as string) || (meta.name as string) || "Usuário";
  return { id: u.id, name };
}
