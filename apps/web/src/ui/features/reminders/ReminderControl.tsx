import { useEffect, useState } from "preact/hooks";
import type { Goal, Weekday } from "@habit/core";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import { enablePushForUser, isIOS, isStandalone, pushSupported } from "../../../infrastructure/push/webPush";

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

const PUSH_MESSAGE: Record<string, string> = {
  unsupported: "Seu navegador não suporta notificações.",
  "needs-install": "No iPhone, adicione o app à Tela de Início primeiro (Compartilhar → Adicionar à Tela de Início).",
  denied: "Permissão de notificação negada. Habilite nas configurações do navegador.",
  "no-key": "Push não configurado no servidor (VAPID ausente).",
  error: "Não foi possível ativar as notificações. Tente de novo.",
};

/** Editor compacto de lembrete de um hábito: horário + dias + ativar/desativar. */
export function ReminderControl({
  goal,
  user,
  onClose,
}: {
  goal: Goal;
  user: CurrentUser;
  onClose: () => void;
}) {
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [pushHint, setPushHint] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    void container.reminders.listForUser(user.id).then((list) => {
      const r = list.find((x) => x.goalId === goal.id);
      if (alive && r) {
        setReminderId(r.id);
        setActive(r.active);
        setTime(r.timeLocal);
        setDays(r.weekdays);
      }
    });
    return () => {
      alive = false;
    };
  }, [goal.id, user.id]);

  const toggleDay = (d: Weekday) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const enableNotifications = async () => {
    setPushHint(null);
    const res = await enablePushForUser(user.id);
    if (res.ok) {
      void container.sync.flush();
      setPushHint("Notificações ativadas neste dispositivo. ✅");
    } else {
      setPushHint(PUSH_MESSAGE[res.reason] ?? "Não foi possível ativar as notificações.");
    }
  };

  const save = async () => {
    setSaved(false);
    try {
      const r = await container.scheduleReminder.execute({
        id: reminderId ?? undefined,
        userId: user.id,
        goalId: goal.id,
        timeLocal: time,
        weekdays: days,
      });
      setReminderId(r.id);
      setActive(true);
      void container.sync.flush();
      setSaved(true);
    } catch {
      setPushHint("Escolha um horário e ao menos um dia da semana.");
    }
  };

  const disable = async () => {
    if (!reminderId) return;
    await container.cancelReminder.execute({ reminderId, userId: user.id });
    setActive(false);
    setSaved(false);
    void container.sync.flush();
  };

  const needsInstallHint = isIOS() && !isStandalone();

  return (
    <div class="mt-2 rounded-xl border border-brand/40 bg-white p-3 text-sm shadow-sm dark:bg-slate-900">
      <div class="flex items-center justify-between">
        <p class="font-medium text-slate-700 dark:text-slate-200">Lembrete{active ? " (ativo)" : ""}</p>
        <button onClick={onClose} class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Fechar">
          ✕
        </button>
      </div>

      {!pushSupported() ? (
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Este navegador não suporta notificações push.</p>
      ) : (
        <>
          <div class="mt-3 flex items-center gap-2">
            <label class="text-slate-600 dark:text-slate-300">Horário</label>
            <input
              type="time"
              value={time}
              onInput={(e) => setTime((e.target as HTMLInputElement).value)}
              class="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div class="mt-3 flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                onClick={() => toggleDay(d.value)}
                class={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  days.includes(d.value)
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {needsInstallHint && (
            <p class="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              📲 No iPhone, toque em <b>Compartilhar → Adicionar à Tela de Início</b> e abra o app por
              lá para receber notificações.
            </p>
          )}

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void enableNotifications()}
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Ativar notificações
            </button>
            <button
              onClick={() => void save()}
              class="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
            >
              Salvar lembrete
            </button>
            {active && (
              <button
                onClick={() => void disable()}
                class="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Desativar
              </button>
            )}
          </div>

          {saved && <p class="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Lembrete salvo. ✅</p>}
          {pushHint && <p class="mt-2 text-xs text-slate-600 dark:text-slate-300">{pushHint}</p>}
        </>
      )}
    </div>
  );
}
