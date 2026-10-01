import { expect, test, type Page } from "@playwright/test";
import { createDomino, tiles } from "../src/games/domino/engine";
const id = (a: number, b: number) =>
  tiles.findIndex((t) => t[0] === Math.min(a, b) && t[1] === Math.max(a, b));
async function importGame(page: Page, mode: "fives" | "draw" = "fives") {
  const config = {
    mode,
    players: 2,
    humans: 2,
    difficulty: "medium",
    target: 100,
  };
  const state = createDomino(config, 42);
  if (mode === "fives") {
    state.turn = 0;
    state.moves = 4;
    state.chain = [
      { id: id(2, 5), left: 2, right: 5 },
      { id: id(5, 5), left: 5, right: 5 },
      { id: id(3, 5), left: 5, right: 3 },
    ];
    state.fives!.spinner = id(5, 5);
    state.fives!.up = [{ id: id(1, 5), left: 5, right: 1 }];
    state.hands = [
      [id(4, 5), id(0, 1)],
      [id(0, 2), id(0, 3), id(0, 4)],
    ];
    const used = [
      ...state.chain.map((t) => t.id),
      ...state.fives!.up.map((t) => t.id),
      ...state.hands.flat(),
    ];
    state.stock = tiles.map((_, i) => i).filter((i) => !used.includes(i));
    state.points = [10, 0];
    state.score = 10;
    state.event = { es: "Turno del jugador 1.", en: "Player 1’s turn." };
  }
  const now = new Date().toISOString();
  const data = {
    format: "timeout-save",
    version: 1,
    preferences: {
      locale: "es",
      theme: "signal",
      mode: "dark",
      sound: false,
      favorites: [],
    },
    sessions: [
      {
        id: "domino-example",
        gameId: "domino",
        gameVersion: mode === "fives" ? 2 : 1,
        config,
        locale: "es",
        state,
        startedAt: now,
        updatedAt: now,
        elapsed: 0,
      },
    ],
    history: [],
  };
  await page.goto("/");
  await page.getByRole("button", { name: /Ajustes/ }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "timeout.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await expect(
    page.getByRole("heading", { name: "Vista previa" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await resume(page);
}
async function resume(page: Page) {
  await page
    .getByRole("button", { name: /Continuar/ })
    .first()
    .click();
  await page
    .locator(".saved-row")
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await page.bringToFront();
  await page.getByRole("button", { name: "Estoy listo", exact: true }).click();
}
test("All Fives is available in setup and can lead any tile", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".game-card")
    .filter({ has: page.getByRole("heading", { name: "Dominó", exact: true }) })
    .getByRole("button", { name: /Jugar/ })
    .click();
  await page
    .getByRole("combobox", { name: "Modalidad", exact: true })
    .selectOption("fives");
  await page
    .getByRole("combobox", { name: "Humanos", exact: true })
    .selectOption("2");
  await page.getByRole("button", { name: /Empezar partida/ }).click();
  await page.bringToFront();
  await page.getByRole("button", { name: "Estoy listo", exact: true }).click();
  await expect(
    page.locator(".domino-rack").getByRole("button", { name: /Colocar/ }),
  ).toHaveCount(7);
  await page
    .locator(".domino-rack")
    .getByRole("button", { name: /Colocar/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Pasa el dispositivo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Estoy listo", exact: true }).click();
  await expect(page.locator(".domino-board-tile")).toHaveCount(1);
});
test("a scoring branch is visible, adds ten points, hides the next hand and survives reload", async ({
  page,
  browserName,
}) => {
  await importGame(page);
  await expect(page.getByLabel("Suma de los extremos")).toContainText(
    "2 + 3 + 1 = 6",
  );
  await expect(page.locator(".domino-board-tile")).toHaveCount(4);
  const move = page.getByRole("button", {
    name: "Colocar 4-5 abajo, +10 puntos",
    exact: true,
  });
  await expect(move).toBeVisible();
  await move.click();
  await expect(
    page.getByRole("heading", { name: "Pasa el dispositivo" }),
  ).toBeVisible();
  await expect(page.locator(".domino-rack")).toHaveCount(0);
  await page.getByRole("button", { name: "Estoy listo", exact: true }).click();
  await expect(page.getByLabel("Suma de los extremos")).toContainText(
    "2 + 3 + 1 + 4 = 10",
  );
  await expect(page.locator(".domino-scores>div").first()).toContainText(
    "20 / 100",
  );
  await expect(page.locator(".domino-board-tile")).toHaveCount(5);
  if (browserName === "chromium")
    await page.screenshot({
      path: "output/playwright/domino-fives.png",
      fullPage: true,
    });
  await page.getByRole("button", { name: /Ajustes/ }).click(); // Flush the save before reload.
  await page.reload();
  await resume(page);
  await expect(page.locator(".domino-board-tile")).toHaveCount(5);
  await expect(page.getByLabel("Suma de los extremos")).toContainText(
    "2 + 3 + 1 + 4 = 10",
  );
});
test("old classic saves still open without changing their mode", async ({
  page,
}) => {
  await importGame(page, "draw");
  await expect(page.locator(".domino-chain")).toContainText("Comienza con");
  await expect(page.locator(".domino-cross")).toHaveCount(0);
  await expect(
    page.locator(".domino-rack").getByRole("button", { name: /Colocar/ }),
  ).toHaveCount(1);
});
test("branch controls fit a narrow touch screen and are usable without overflowing the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importGame(page);
  const move = page.getByRole("button", {
    name: "Colocar 4-5 abajo, +10 puntos",
    exact: true,
  });
  await expect(move).toHaveCSS("min-height", "44px");
  await move.click();
  await page.getByRole("button", { name: "Estoy listo", exact: true }).click();
  await expect(page.locator(".domino-board-tile")).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
