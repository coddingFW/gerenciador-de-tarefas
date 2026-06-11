import { createEvent } from "../../domain/events/index.js";
import type { ICategoryRepository, IEventBus } from "../ports/index.js";

export interface ReorderCategoriesInput {
  userId: string;
  /** IDs na nova ordem desejada; o índice vira o `sortOrder`. */
  orderedIds: string[];
}

/**
 * Reordena categorias atribuindo `sortOrder` = posição no array. Só persiste as
 * que realmente mudaram de posição. Falha se algum id não for do usuário.
 */
export class ReorderCategories {
  constructor(
    private readonly categories: ICategoryRepository,
    private readonly bus: IEventBus,
  ) {}

  async execute(input: ReorderCategoriesInput): Promise<void> {
    let changed = false;
    for (let i = 0; i < input.orderedIds.length; i++) {
      const id = input.orderedIds[i]!;
      const category = await this.categories.byId(id);
      if (!category || category.userId !== input.userId) throw new Error("CATEGORY_NOT_FOUND");
      if (category.sortOrder !== i) {
        category.sortOrder = i;
        await this.categories.save(category);
        changed = true;
      }
    }
    if (changed) {
      await this.bus.publish(createEvent("CategoryUpdated", input.userId, input.userId, { reordered: true }));
    }
  }
}
