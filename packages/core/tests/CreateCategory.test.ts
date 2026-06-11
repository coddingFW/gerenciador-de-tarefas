import { beforeEach, describe, expect, it } from "vitest";
import { CreateCategory } from "../src/application/use-cases/CreateCategory.js";
import { FakeCategoryRepository, FakeEventBus, FakeIdGenerator } from "./fakes.js";

describe("CreateCategory", () => {
  let categories: FakeCategoryRepository;
  let bus: FakeEventBus;
  let useCase: CreateCategory;

  beforeEach(() => {
    categories = new FakeCategoryRepository();
    bus = new FakeEventBus();
    useCase = new CreateCategory(categories, bus, new FakeIdGenerator());
  });

  it("cria a categoria, faz trim e publica CategoryCreated", async () => {
    const c = await useCase.execute({ userId: "u1", name: "  Saúde  ", color: "#0ea5e9", icon: "💪" });
    expect(c.name).toBe("Saúde");
    expect(c.color).toBe("#0ea5e9");
    expect(c.archived).toBe(false);
    expect(c.sortOrder).toBe(0);
    expect(bus.types()).toEqual(["CategoryCreated"]);
  });

  it("atribui sortOrder ao final da lista existente", async () => {
    await useCase.execute({ userId: "u1", name: "Saúde" });
    const second = await useCase.execute({ userId: "u1", name: "Estudos" });
    expect(second.sortOrder).toBe(1);
  });

  it("rejeita nome vazio", async () => {
    await expect(useCase.execute({ userId: "u1", name: "   " })).rejects.toThrow(
      "CATEGORY_NAME_REQUIRED",
    );
  });

  it("rejeita nome duplicado (case-insensitive)", async () => {
    await useCase.execute({ userId: "u1", name: "Saúde" });
    await expect(useCase.execute({ userId: "u1", name: "saúde" })).rejects.toThrow(
      "CATEGORY_NAME_TAKEN",
    );
  });
});
