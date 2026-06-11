import type { Category } from "@habit/core";

/** Selo visual de categoria: ponto colorido + ícone + nome (reutilizado no agrupamento). */
export function CategoryBadge({ category, className = "" }: { category: Category; className?: string }) {
  return (
    <span class={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: category.color ?? "#cbd5e1" }}
      />
      {category.icon && <span aria-hidden="true">{category.icon}</span>}
      <span class="truncate">{category.name}</span>
    </span>
  );
}
