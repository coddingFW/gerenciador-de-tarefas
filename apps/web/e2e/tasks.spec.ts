import { expect, test } from "@playwright/test";

// Tarefas avulsas: criar → concluir → desfazer.
test("criar, concluir e desfazer uma tarefa avulsa", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tarefas" }).click();

  // ---- criar ----
  await page.getByPlaceholder("Ex.: Pagar a conta de luz").fill("Pagar conta de luz");
  await page.getByRole("button", { name: "Adicionar" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Pagar conta de luz" });
  await expect(row).toBeVisible();

  // ---- concluir → migra para "Concluídas" com botão Desfazer ----
  await row.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("heading", { name: "Concluídas" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Desfazer" })).toBeVisible();

  // ---- desfazer → volta para "Pendentes" com botão Concluir ----
  await row.getByRole("button", { name: "Desfazer" }).click();
  await expect(row.getByRole("button", { name: "Concluir" })).toBeVisible();
});
