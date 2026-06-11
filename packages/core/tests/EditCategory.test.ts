import { beforeEach, describe, expect, it } from "vitest";
import { EditCategory } from "../src/application/use-cases/EditCategory.js";
import type { Category } from "../src/domain/entities/index.js";
import { FakeCategoryRepository, FakeEventBus } from "./fakes.js";

const cat = (over: Partial<Category> = {}): Category => ({
  id: "c1",
  userId: "u1",
  name: "Saúde",
  color: null,
  icon: null,
  archived: false,
  sortOrder: 0,
  ...over,
});

describe("EditCategory", () => {
  let categories: FakeCategoryRepository;
  let bus: FakeEventBus;
  let useCase: EditCategory;

  beforeEach(() => {
    categories = new FakeCategoryRepository([cat()]);
    bus = new FakeEventBus();
    useCase = new EditCategory(categories, bus);
  });

  it("aplica patch parcial e publica CategoryUpdated", async () => {
    const c = await useCase.execute({ categoryId: "c1", userId: "u1", color: "#16a34a", icon: "🏃" });
    expect(c.color).toBe("#16a34a");
    expect(c.icon).toBe("🏃");
    expect(c.name).toBe("Saúde");
    expect(bus.types()).toEqual(["CategoryUpdated"]);
  });

  it("permite arquivar", async () => {
    const c = await useCase.execute({ categoryId: "c1", userId: "u1", archived: true });
    expect(c.archived).toBe(true);
  });

  it("rejeita nome duplicado de outra categoria", async () => {
    await categories.save(cat({ id: "c2", name: "Estudos", sortOrder: 1 }));
    await expect(
      useCase.execute({ categoryId: "c1", userId: "u1", name: "Estudos" }),
    ).rejects.toThrow("CATEGORY_NAME_TAKEN");
  });

  it("não deixa outro usuário editar (ownership)", async () => {
    await expect(useCase.execute({ categoryId: "c1", userId: "intruso" })).rejects.toThrow(
      "CATEGORY_NOT_FOUND",
    );
  });
});
