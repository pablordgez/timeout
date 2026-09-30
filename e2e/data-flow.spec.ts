import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
async function settings(page: Page) {
  await page.getByRole("button", { name: /Ajustes/ }).click();
}
async function exported(page: Page) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar todos los datos/ }).click();
  return readFile((await (await event).path())!);
}
async function importBuffer(page: Page, bytes: Buffer) {
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "timeout.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await expect(
    page.getByRole("heading", { name: "Vista previa" }),
  ).toBeVisible();
}
test("web and portable exchange exact pending states and reject corrupt imports", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .locator(".game-card")
    .filter({ has: page.getByRole("heading", { name: "Sudoku", exact: true }) })
    .getByRole("button", { name: /Jugar/ })
    .click();
  await page.getByRole("button", { name: /Empezar partida/ }).click();
  await expect(page.locator(".sudoku-cell")).toHaveCount(81);
  await page.locator(".play-heading").getByRole("button").click();
  await settings(page);
  const first = await exported(page),
    data = JSON.parse(first.toString());
  const portable = await context.newPage();
  await portable.goto(pathToFileURL(resolve("dist-portable/index.html")).href);
  await expect(portable.locator(".game-card")).toHaveCount(16);
  await settings(portable);
  await importBuffer(portable, first);
  await portable
    .getByRole("combobox", { name: "Modo de importación" })
    .selectOption("replace");
  await portable.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(
    portable.getByRole("heading", { name: "Vista previa" }),
  ).toHaveCount(0);
  const second = await exported(portable);
  expect(JSON.parse(second.toString()).sessions).toEqual(data.sessions);
  await importBuffer(page, second);
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("heading", { name: "Vista previa" })).toHaveCount(
    0,
  );
  const corrupt = { ...data, version: 99 };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(corrupt)),
    });
  await expect(page.getByRole("alert")).toContainText("Unsupported save");
  await page
    .getByRole("button", { name: /Continuar/ })
    .first()
    .click();
  await expect(page.locator(".saved-row")).toHaveCount(1);
  await page
    .locator(".saved-row")
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar →", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sudoku-cell")).toHaveCount(81);
});
test("sound preference survives reload and remains directly accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Silenciar efectos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Silenciar efectos" }).click();
  await expect(
    page.getByRole("button", { name: "Activar efectos" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Activar efectos" }),
  ).toBeVisible();
  await settings(page);
  await expect(
    page.getByRole("checkbox", { name: "Efectos de sonido" }),
  ).not.toBeChecked();
});
test("dependent setup choices stay relevant and human counts remain valid", async ({
  page,
}) => {
  await page.goto("/");
  const open = async (name: string) => {
    await page
      .locator(".game-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: /Jugar/ })
      .click();
  };
  await open("Ajedrez");
  await page
    .getByRole("combobox", { name: "Jugadores humanos", exact: true })
    .selectOption("2");
  await expect(
    page.getByRole("combobox", { name: "Dificultad", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await open("Dominó");
  await page
    .getByRole("combobox", { name: "Modalidad", exact: true })
    .selectOption("pairs");
  await expect(
    page.getByRole("combobox", { name: "Jugadores", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Humanos", exact: true })
    .selectOption("4");
  await expect(
    page.getByRole("combobox", { name: "Dificultad", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Modalidad", exact: true })
    .selectOption("draw");
  await expect(
    page.getByRole("combobox", { name: "Humanos", exact: true }),
  ).toHaveValue("2");
  await page.keyboard.press("Escape");
  await open("Caída de bloques");
  await expect(
    page.getByRole("combobox", { name: "Líneas objetivo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Tiempo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Objetivo", exact: true })
    .selectOption("lines");
  await expect(
    page.getByRole("combobox", { name: "Líneas objetivo", exact: true }),
  ).toBeVisible();
});
