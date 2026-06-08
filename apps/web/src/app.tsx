import { useState } from "preact/hooks";
import { useAuth } from "./lib/auth";
import { SyncBadge } from "./ui/components/SyncBadge";
import { TodayPage } from "./ui/features/today/TodayPage";
import { DashboardPage } from "./ui/features/dashboard/DashboardPage";

type Tab = "today" | "dashboard";

export function App() {
  const { user, loading, backend, signInWithGoogle, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("today");

  if (loading) {
    return <Centered>Carregando…</Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 class="text-lg font-bold text-slate-800">Habit Tracker</h1>
          <p class="mt-1 text-sm text-slate-500">Acompanhe hábitos e produtividade.</p>
          <button
            onClick={() => void signInWithGoogle()}
            class="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Entrar com Google
          </button>
        </div>
      </Centered>
    );
  }

  return (
    <div class="mx-auto flex min-h-full max-w-xl flex-col">
      <header class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div>
          <h1 class="text-base font-bold text-slate-800">Habit Tracker</h1>
          <p class="text-xs text-slate-500">{user.name}</p>
        </div>
        <div class="flex items-center gap-2">
          <SyncBadge />
          {backend && (
            <button onClick={() => void signOut()} class="text-xs text-slate-500 hover:text-slate-800">
              Sair
            </button>
          )}
        </div>
      </header>

      <nav class="flex gap-1 px-4 pt-3">
        <TabButton active={tab === "today"} onClick={() => setTab("today")}>
          Hoje
        </TabButton>
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          Painel
        </TabButton>
      </nav>

      <main class="flex-1 p-4">
        {tab === "today" ? <TodayPage user={user} /> : <DashboardPage user={user} />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: preact.ComponentChildren;
}) {
  return (
    <button
      onClick={onClick}
      class={`rounded-lg px-4 py-1.5 text-sm font-medium ${
        active ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: preact.ComponentChildren }) {
  return <div class="flex min-h-full items-center justify-center p-6 text-sm text-slate-500">{children}</div>;
}
