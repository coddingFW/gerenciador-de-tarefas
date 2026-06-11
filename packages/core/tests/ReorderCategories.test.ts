import { beforeEach, describe, expect, it } from "vitest";
import { ReorderCategories } from "../src/application/use-cases/ReorderCategories.js";
import type { Category } from "../src/domain/entities/index.js";
import { FakeCategoryRepository, FakeEventBus } from "./fakes.js";

const cat = (id: string, sortOrder: number): Category => ({
  id,
  userId: "u1",
  name: id,
  color: null,
  icon: null,
  archived: false,
  sortOrder,
});

describe("ReorderCategories", () => {
  let categories: FakeCategoryRepository;
  let bus: FakeEventBus;
  let useCase: ReorderCategories;

  beforeEach(() => {
    categories = new FakeCategoryRepository([cat("a", 0), cat("b", 1), cat("c", 2)]);
    bus = new FakeEventBus();
    useCase = new ReorderCategories(categories, bus);
  });

  it("reatribui sortOrder conforme a nova ordem", async () => {
    await useCase.execute({ userId: "u1", orderedIds: ["c", "a", "b"] });
    const list = await categories.listFor("u1");
    expect(list.map((c) => c.id)).toEqual(["c", "a", "b"]);
    expect(list.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
    expect(bus.types()).toEqual(["CategoryUpdated"]);
  });

  it("não publica evento quando a ordem não muda", async () => {
    await useCase.execute({ userId: "u1", orderedIds: ["a", "b", "c"] });
    expect(bus.types()).toEqual([]);
  });

  it("falha se algum id não for do usuário", async () => {
    await categories.save({ ...cat("x", 0), userId: "outro" });
    await expect(
      useCase.execute({ userId: "u1", orderedIds: ["a", "x"] }),
    ).rejects.toThrow("CATEGORY_NOT_FOUND");
  });
});
