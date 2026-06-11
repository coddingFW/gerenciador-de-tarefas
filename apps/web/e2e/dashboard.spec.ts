import { expect, test } from "@playwright/test";

// Dashboard histórico: estados e troca de janela 7d/30d.
test("histórico mostra estado vazio e alterna 7d/30d", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Painel" }).click();

  const history = page.locator("section").filter({ has: page.getByRole("heading", { name: "Histórico" }) });
  await expect(history).toBeVisible();

  // Sem execuções → estado vazio.
  await expect(history.getByText("Sem dados ainda.", { exact: false })).toBeVisible();

  // Registra uma execução na aba Hoje para o histórico ter dados.
  await page.getByRole("button", { name: "Hoje" }).click();
  await page.getByPlaceholder("Ex.: Ler 10 páginas").fill("Correr");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("button", { name: "Concluir" }).click();

  // Volta ao Painel: o gráfico (SVG) deve renderizar a janela selecionada.
  await page.getByRole("button", { name: "Painel" }).click();
  const svg = history.locator("svg");
  await expect(svg).toBeVisible();
  await expect(svg.locator("rect")).toHaveCount(7);

  await history.getByRole("button", { name: "30d" }).click();
  await expect(svg.locator("rect")).toHaveCount(30);
});
