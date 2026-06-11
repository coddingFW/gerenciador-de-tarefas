/** Paleta e ícones (emoji) para categorias. Mantém zero dependência de libs. */
export const CATEGORY_COLORS = [
  "#0ea5e9",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
] as const;

export const CATEGORY_ICONS = ["💪", "📚", "🧘", "🏃", "💼", "🎯", "🎨", "💧", "🌙", "❤️"] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];
export const DEFAULT_CATEGORY_ICON = CATEGORY_ICONS[0];
