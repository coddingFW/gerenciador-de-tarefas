import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import type { Category } from "@habit/core";
import { localDB } from "../../../infrastructure/persistence/db";
import { container } from "../../../lib/container";
import type { CurrentUser } from "../../../lib/auth";
import { CATEGORY_COLORS, CATEGORY_ICONS, DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "./constants";
import { CategoryBadge } from "./CategoryBadge";

/** Gerência de categorias: criar, editar, reordenar e arquivar. */
export function CategoriesPage({ user }: { user: CurrentUser }) {
  const categories = useLiveQuery(
    () =>
      localDB.categories
        .where("userId")
        .equals(user.id)
        .filter((c) => !c.archived)
        .sortBy("sortOrder"),
    [user.id],
  );

  return (
    <div class="flex flex-col gap-4">
      <AddCategoryForm user={user} />

      <section>
        <h2 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Suas categorias</h2>
        {categories === undefined ? (
          <Skeleton />
        ) : categories.length === 0 ? (
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhuma categoria ainda. Crie a primeira acima 👆
          </p>
        ) : (
          <ul class="flex flex-col gap-2">
            {categories.map((c, i) => (
              <CategoryRow
                key={c.id}
                category={c}
                user={user}
                isFirst={i === 0}
                isLast={i === categories.length - 1}
                order={categories.map((x) => x.id)}
                index={i}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddCategoryForm({ user }: { user: CurrentUser }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await container.createCategory.execute({ userId: user.id, name, color, icon });
      setName("");
      void container.sync.flush();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "CATEGORY_NAME_TAKEN"
          ? "Já existe uma categoria com esse nome."
          : "Informe um nome válido.",
      );
    }
  };

  return (
    <form onSubmit={submit} class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Nova categoria</h2>
      <div class="flex flex-col gap-3">
        <input
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="Ex.: Saúde"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} />
        <button
          type="submit"
          class="self-start rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Adicionar
        </button>
      </div>
      {error && <p class="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

function CategoryRow({
  category,
  user,
  isFirst,
  isLast,
  order,
  index,
}: {
  category: Category;
  user: CurrentUser;
  isFirst: boolean;
  isLast: boolean;
  order: string[];
  index: number;
}) {
  const [editing, setEditing] = useState(false);

  const move = async (delta: -1 | 1) => {
    const next = [...order];
    const target = index + delta;
    [next[index], next[target]] = [next[target]!, next[index]!];
    await container.reorderCategories.execute({ userId: user.id, orderedIds: next });
    void container.sync.flush();
  };

  const archive = async () => {
    await container.editCategory.execute({ categoryId: category.id, userId: user.id, archived: true });
    void container.sync.flush();
  };

  if (editing) {
    return <CategoryEditor category={category} user={user} onClose={() => setEditing(false)} />;
  }

  return (
    <li class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CategoryBadge category={category} className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100" />
      <div class="ml-3 flex shrink-0 items-center gap-1 text-slate-400 dark:text-slate-500">
        <button
          onClick={() => void move(-1)}
          disabled={isFirst}
          aria-label="Mover para cima"
          class="rounded px-1.5 py-1 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          onClick={() => void move(1)}
          disabled={isLast}
          aria-label="Mover para baixo"
          class="rounded px-1.5 py-1 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar categoria"
          class="rounded px-2 py-1 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          ✎
        </button>
        <button
          onClick={() => void archive()}
          aria-label="Arquivar categoria"
          class="rounded px-2 py-1 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
        >
          🗑
        </button>
      </div>
    </li>
  );
}

function CategoryEditor({
  category,
  user,
  onClose,
}: {
  category: Category;
  user: CurrentUser;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState<string>(category.color ?? DEFAULT_CATEGORY_COLOR);
  const [icon, setIcon] = useState<string>(category.icon ?? DEFAULT_CATEGORY_ICON);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await container.editCategory.execute({ categoryId: category.id, userId: user.id, name, color, icon });
      void container.sync.flush();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "CATEGORY_NAME_TAKEN"
          ? "Já existe uma categoria com esse nome."
          : "Informe um nome válido.",
      );
    }
  };

  return (
    <li class="rounded-xl border border-brand/40 bg-white p-3 shadow-sm dark:bg-slate-900">
      <form onSubmit={save} class="flex flex-col gap-3">
        <input
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} />
        <div class="flex gap-1">
          <button type="submit" class="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Salvar
          </button>
          <button
            type="button"
            onClick={onClose}
            class="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      </form>
      {error && <p class="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Cor ${c}`}
          aria-pressed={value === c}
          class={`h-7 w-7 rounded-full ring-offset-2 ${value === c ? "ring-2 ring-slate-400" : ""}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (i: string) => void }) {
  return (
    <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícone">
      {CATEGORY_ICONS.map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          aria-label={`Ícone ${i}`}
          aria-pressed={value === i}
          class={`h-8 w-8 rounded-lg text-base ${value === i ? "bg-brand/10 ring-1 ring-brand" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <ul class="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <li key={i} class="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
      ))}
    </ul>
  );
}
