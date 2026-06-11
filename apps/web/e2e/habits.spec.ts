import { expect, test } from "@playwright/test";

// Ciclo de vida completo de um hábito na tela Hoje (modo demo offline):
// criar → concluir → editar → arquivar. Cobre US-02/US-03/US-04 ponta a ponta.
test("criar, concluir, editar e arquivar um hábito", async ({ page }) => {
  await page.goto("/");

  // Garante a aba Hoje (independe do default).
  await page.getByRole("button", { name: "Hoje" }).click();

  const list = page.getByRole("list");

  // ---- criar ----
  await page.getByPlaceholder("Ex.: Ler 10 páginas").fill("Correr");
  await page.getByRole("button", { name: "Adicionar" }).click();

  const row = list.getByRole("listitem").filter({ hasText: "Correr" });
  await expect(row).toBeVisible();
  await expect(page.getByText("0/1 concluídos")).toBeVisible();

  // ---- concluir (otimista) ----
  await row.getByRole("button", { name: "Concluir" }).click();
  await expect(row.getByRole("button", { name: "✓ Feito" })).toBeDisabled();
  await expect(page.getByText("1/1 concluídos")).toBeVisible();

  // ---- editar (inline) ----
  await row.getByRole("button", { name: "Editar hábito" }).click();
  const editor = list.getByRole("listitem").filter({ has: page.locator("form") });
  await editor.locator('input:not([type="number"])').first().fill("Correr 5km");
  await editor.locator("select").selectOption("weekly");
  await editor.getByRole("button", { name: "Salvar" }).click();

  const edited = list.getByRole("listitem").filter({ hasText: "Correr 5km" });
  await expect(edited).toBeVisible();
  await expect(edited.getByText("Semanal")).toBeVisible();

  // ---- arquivar (soft delete) ----
  await edited.getByRole("button", { name: "Arquivar hábito" }).click();
  await expect(page.getByText("Nenhum hábito ainda.", { exact: false })).toBeVisible();
});
