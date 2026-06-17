import type { Theme } from "@habit/core";

const NEXT: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
const ICON: Record<Theme, string> = { light: "☀️", dark: "🌙", system: "🌗" };
const LABEL: Record<Theme, string> = { light: "Tema claro", dark: "Tema escuro", system: "Tema do sistema" };

/** Botão compacto que cicla Claro → Escuro → Sistema (reusa o seletor da Etapa 2). */
export function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <button
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`${LABEL[theme]} (tocar para alternar)`}
      title={LABEL[theme]}
      class="rounded-lg px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {ICON[theme]}
    </button>
  );
}
