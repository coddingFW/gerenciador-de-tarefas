import { useRef, useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import type { Theme } from "@habit/core";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import { uploadAvatar } from "../../../infrastructure/storage/avatarStorage";
import { supabase } from "../../../infrastructure/supabase/client";
import { exportUserDataJson } from "../../../lib/exportData";
import type { CurrentUser } from "../../../lib/auth";
import { Avatar } from "../../components/Avatar";

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: string }> = [
  { value: "light", label: "Claro", icon: "☀️" },
  { value: "dark", label: "Escuro", icon: "🌙" },
  { value: "system", label: "Sistema", icon: "🌗" },
];

/** Tela de Perfil: foto, tema e dados básicos (Fase 3 Etapa 2). */
export function ProfilePage({
  user,
  theme,
  setTheme,
  onBack,
}: {
  user: CurrentUser;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onBack: () => void;
}) {
  const profile = useLiveQuery(() => localDB.profiles.get(user.id), [user.id]);
  const avatarUrl = profile?.avatarUrl ?? user.avatarUrl;

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  const onExport = () => void exportUserDataJson(user.id);

  const onDelete = async () => {
    setDeleting(true);
    setDelError(null);
    try {
      if (supabase) {
        const { error: fnError } = await supabase.functions.invoke("delete-account", { method: "POST" });
        if (fnError) throw fnError;
        await supabase.auth.signOut();
      }
      await localDB.delete();
      localStorage.clear();
      window.location.reload();
    } catch {
      setDelError("Não foi possível excluir a conta. Tente novamente.");
      setDeleting(false);
    }
  };

  const onPick = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const url = await uploadAvatar(user.id, file);
      await container.updateProfile.execute({ userId: user.id, avatarUrl: url });
      void container.sync.flush();
    } catch {
      setError("Não foi possível atualizar a foto. Tente uma imagem menor.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div class="flex flex-col gap-5">
      <div class="flex items-center gap-2">
        <button
          onClick={onBack}
          class="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Voltar"
        >
          ← Voltar
        </button>
        <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">Perfil</h2>
      </div>

      <section class="flex flex-col items-center gap-3">
        <Avatar name={user.name} avatarUrl={avatarUrl} size={96} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          class="hidden"
          onChange={(e) => void onPick(e)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Alterar foto"}
        </button>
        {error && <p class="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{user.name}</p>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Aparência</h3>
        <div class="flex gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              aria-pressed={theme === opt.value}
              class={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
                theme === opt.value
                  ? "bg-brand text-white"
                  : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <span aria-hidden="true">{opt.icon}</span> {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Conta</h3>
        <dl class="flex flex-col gap-1 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500 dark:text-slate-400">Fuso horário</dt>
            <dd class="text-slate-800 dark:text-slate-200">{user.timezone}</dd>
          </div>
        </dl>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Privacidade</h3>
        <button
          onClick={onExport}
          class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Exportar meus dados (JSON)
        </button>

        <div class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              class="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Excluir conta
            </button>
          ) : (
            <div class="flex flex-col gap-2">
              <p class="text-sm text-red-600 dark:text-red-400">
                Isto apaga <b>todos</b> os seus dados e é irreversível.
              </p>
              <div class="flex gap-2">
                <button
                  onClick={() => void onDelete()}
                  disabled={deleting}
                  class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  class="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {delError && <p class="mt-2 text-xs text-red-600 dark:text-red-400">{delError}</p>}
        </div>
      </section>
    </div>
  );
}
