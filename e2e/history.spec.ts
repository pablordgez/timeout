import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function snapshot(page: Page) {
  await page.getByRole("button", { name: /Ajustes/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar todos los datos/ }).click();
  return JSON.parse(await readFile((await (await download).path())!, "utf8"));
}

test("guided practice preserves the real game and a completed result is recorded once", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".game-card")
    .filter({
      has: page.getByRole("heading", { name: "Cinco letras", exact: true }),
    })
    .getByRole("button", { name: /Jugar/ })
    .click();
  await page.getByRole("button", { name: /Empezar partida/ }).click();
  await expect(page.locator(".letter-cell")).toHaveCount(30);
  await page.locator(".play-heading").getByRole("button").click();
  const pending = await snapshot(page);
  await page
    .getByRole("button", { name: /Continuar/ })
    .first()
    .click();
  await page
    .locator(".saved-row")
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await page.getByRole("button", { name: "Guía ?" }).click();
  await page.getByRole("button", { name: "Abrir práctica guiada" }).click();
  await expect(page.getByText("PRÁCTICA · NO CUENTA")).toBeVisible();
  await page.getByRole("button", { name: "3. Práctica", exact: true }).click();
  await page.getByRole("button", { name: /Probar este paso/ }).click();
  await page.getByRole("button", { name: "Terminar práctica" }).click();
  await page.getByRole("button", { name: "Cerrar guía" }).click();
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
  expect(
    await page
      .locator(
        ".letter-cell.correct, .letter-cell.present, .letter-cell.absent",
      )
      .count(),
  ).toBe(0);
  await page
    .getByRole("textbox", { name: "Palabra", exact: true })
    .fill(pending.sessions[0].state.target);
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Partida completada", exact: true }),
  ).toBeVisible();
  await page.locator(".play-heading").getByRole("button").click();
  const first = await snapshot(page);
  expect(first.sessions).toHaveLength(0);
  expect(first.history).toHaveLength(1);
  expect(first.history[0].state.guesses).toEqual([
    pending.sessions[0].state.target,
  ]);
  expect(first.history[0].state.score).toBe(600);
  await page.reload();
  const second = await snapshot(page);
  expect(second.history).toEqual(first.history);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
});
