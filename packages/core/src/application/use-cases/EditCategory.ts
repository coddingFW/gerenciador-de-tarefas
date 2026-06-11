import type { Category } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { ICategoryRepository, IEventBus } from "../ports/index.js";

export interface EditCategoryInput {
  categoryId: string;
  userId: string;
  /** Campos omitidos (undefined) ficam inalterados. */
  name?: string;
  color?: string | null;
  icon?: string | null;
  archived?: boolean;
}

/** Edita uma categoria (patch parcial). Revalida nome e unicidade. */
export class EditCategory {
  constructor(
    private readonly categories: ICategoryRepository,
    private readonly bus: IEventBus,
  ) {}

  async execute(input: EditCategoryInput): Promise<Category> {
    const category = await this.categories.byId(input.categoryId);
    if (!category || category.userId !== input.userId) throw new Error("CATEGORY_NOT_FOUND");

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0) throw new Error("CATEGORY_NAME_REQUIRED");
      const siblings = await this.categories.listFor(input.userId);
      if (
        siblings.some(
          (c) => c.id !== category.id && c.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new Error("CATEGORY_NAME_TAKEN");
      }
      category.name = name;
    }
    if (input.color !== undefined) category.color = input.color;
    if (input.icon !== undefined) category.icon = input.icon;
    if (input.archived !== undefined) category.archived = input.archived;

    await this.categories.save(category);
    await this.bus.publish(createEvent("CategoryUpdated", category.id, category.userId, {}));
    return category;
  }
}
