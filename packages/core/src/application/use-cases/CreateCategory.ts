import type { Category } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { ICategoryRepository, IEventBus, IIdGenerator } from "../ports/index.js";

export interface CreateCategoryInput {
  userId: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

/**
 * Cria uma categoria. `sortOrder` é atribuído ao final da lista atual. Valida
 * nome obrigatório e unicidade (case-insensitive) — defesa em profundidade junto
 * ao `unique (user_id, name)` do banco.
 */
export class CreateCategory {
  constructor(
    private readonly categories: ICategoryRepository,
    private readonly bus: IEventBus,
    private readonly ids: IIdGenerator,
  ) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    const name = input.name.trim();
    if (name.length === 0) throw new Error("CATEGORY_NAME_REQUIRED");

    const existing = await this.categories.listFor(input.userId);
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("CATEGORY_NAME_TAKEN");
    }

    const category: Category = {
      id: this.ids.uuid(),
      userId: input.userId,
      name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      archived: false,
      sortOrder: existing.length,
    };

    await this.categories.save(category);
    await this.bus.publish(createEvent("CategoryCreated", category.id, category.userId, { name }));
    return category;
  }
}
