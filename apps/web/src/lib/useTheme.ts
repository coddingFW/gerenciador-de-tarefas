import { useEffect } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import type { Theme } from "@habit/core";
import { container } from "./container";
import { localDB } from "../infrastructure/persistence/db";

const STORAGE_KEY = "habit.theme";

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

/** Aplica o tema no <html> e na barra de status, resolvendo 'system'. */
function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const dark = theme === "dark" || (theme === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0b1120" : "#0ea5e9");
}

function localTheme(): Theme {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/**
 * Fonte da verdade do tema = profile no Dexie (sincronizado). localStorage é o
 * cache anti-FOUC. Quando um valor novo chega pelo sync/realtime, o tema é
 * REAPLICADO silenciosamente (merge consistente: registro local pendente vence).
 */
export function useTheme(userId: string | undefined): { theme: Theme; setTheme: (t: Theme) => void } {
  const profile = useLiveQuery(() => (userId ? localDB.profiles.get(userId) : undefined), [userId]);
  const theme: Theme = profile?.theme ?? localTheme();

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage indisponível (modo restrito): tema ainda aplica na sessão.
    }
  }, [theme]);

  // Quando o tema é 'system', acompanha mudanças do SO em tempo real.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme): void => {
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
    if (userId) {
      void container.updateProfile.execute({ userId, theme: t }).then(() => container.sync.flush());
    }
  };

  return { theme, setTheme };
}
