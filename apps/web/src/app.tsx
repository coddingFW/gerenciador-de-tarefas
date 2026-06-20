import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "./lib/auth";
import { useTheme } from "./lib/useTheme";
import { localDB } from "./infrastructure/persistence/db";
import { SyncBadge } from "./ui/components/SyncBadge";
import { ThemeToggle } from "./ui/components/ThemeToggle";
import { Avatar } from "./ui/components/Avatar";
import { TodayPage } from "./ui/features/today/TodayPage";
import { TasksPage } from "./ui/features/tasks/TasksPage";
import { CalendarPage } from "./ui/features/calendar/CalendarPage";
import { CategoriesPage } from "./ui/features/categories/CategoriesPage";
import { DashboardPage } from "./ui/features/dashboard/DashboardPage";
import { ProfilePage } from "./ui/features/profile/ProfilePage";

type Tab = "today" | "tasks" | "calendar" | "categories" | "dashboard";

export function App() {
  const { user, loading, backend, signInWithGoogle, signOut } = useAuth();
  const { theme, setTheme } = useTheme(user?.id);
  const [tab, setTab] = useState<Tab>("today");
  const [showProfile, setShowProfile] = useState(false);
  const profile = useLiveQuery(() => (user ? localDB.profiles.get(user.id) : undefined), [user?.id]);

  if (loading) {
    return <Centered>Carregando…</Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">Habit Tracker</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Acompanhe hábitos e produtividade.</p>
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

  const avatarUrl = profile?.avatarUrl ?? user.avatarUrl;

  return (
    <div class="mx-auto flex min-h-full max-w-xl flex-col">
      <header class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div>
          <h1 class="text-base font-bold text-slate-800 dark:text-slate-100">Habit Tracker</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">{user.name}</p>
        </div>
        <div class="flex items-center gap-2">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <SyncBadge />
          {backend && (
            <button
              onClick={() => void signOut()}
              class="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Sair
            </button>
          )}
          <button onClick={() => setShowProfile(true)} aria-label="Abrir perfil" class="rounded-full">
            <Avatar name={user.name} avatarUrl={avatarUrl} size={28} />
          </button>
        </div>
      </header>

      {showProfile ? (
        <main class="flex-1 p-4">
          <ProfilePage user={user} theme={theme} setTheme={setTheme} onBack={() => setShowProfile(false)} />
        </main>
      ) : (
        <>
          <nav class="flex gap-1 overflow-x-auto px-4 pt-3">
            <TabButton active={tab === "today"} onClick={() => setTab("today")}>
              Hoje
            </TabButton>
            <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")}>
              Tarefas
            </TabButton>
            <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>
              Calendário
            </TabButton>
            <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
              Categorias
            </TabButton>
            <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              Painel
            </TabButton>
          </nav>

          <main class="flex-1 p-4">
            {tab === "today" && <TodayPage user={user} />}
            {tab === "tasks" && <TasksPage user={user} />}
            {tab === "calendar" && <CalendarPage user={user} />}
            {tab === "categories" && <CategoriesPage user={user} />}
            {tab === "dashboard" && <DashboardPage user={user} />}
          </main>
        </>
      )}
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
      class={`shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium ${
        active
          ? "bg-brand text-white"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: preact.ComponentChildren }) {
  return (
    <div class="flex min-h-full items-center justify-center p-6 text-sm text-slate-500 dark:text-slate-400">
      {children}
    </div>
  );
}
