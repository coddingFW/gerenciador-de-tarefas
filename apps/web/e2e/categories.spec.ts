import { expect, test } from "@playwright/test";

// Categorias + agrupamento de hábitos por categoria na tela Hoje.
test("criar categoria e agrupar um hábito por ela", async ({ page }) => {
  await page.goto("/");

  // ---- cria a categoria ----
  await page.getByRole("button", { name: "Categorias" }).click();
  await page.getByPlaceholder("Ex.: Saúde").fill("Saúde");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Saúde" })).toBeVisible();

  // ---- cria um hábito associado à categoria ----
  await page.getByRole("button", { name: "Hoje" }).click();
  await page.getByPlaceholder("Ex.: Ler 10 páginas").fill("Beber água");
  await page.getByRole("combobox", { name: "Categoria" }).selectOption({ label: "💪 Saúde" });
  await page.getByRole("button", { name: "Adicionar" }).click();

  // ---- o grupo da categoria aparece com o hábito dentro ----
  await expect(page.getByRole("heading", { name: "Saúde" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Beber água" })).toBeVisible();
});
