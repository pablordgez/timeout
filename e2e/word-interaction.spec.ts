import { test, expect, type Page } from "@playwright/test";

async function choose(page: Page, name: string) {
  await page.goto("/");
  await page
    .locator(".game-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: /^Jugar/ })
    .click();
}
async function start(page: Page) {
  await page.getByRole("button", { name: /Empezar partida/ }).click();
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
}
async function state(page: Page, id: string) {
  return page.evaluate(
    (id) =>
      new Promise<any>((resolve, reject) => {
        const request = indexedDB.open("timeout");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction("data").objectStore("data").get("main");
          get.onsuccess = () => {
            resolve(
              [...get.result.sessions, ...get.result.history].find(
                (s) => s.gameId === id,
              )?.state,
            );
            db.close();
          };
          get.onerror = () => reject(get.error);
        };
      }),
    id,
  );
}
async function checkCrossing(page: Page, touch = false) {
  await choose(page, "Crucigramas");
  await start(page);
  const s = await state(page, "crossword");
  const across = s.puzzle.slots.filter((slot) => slot.direction === "across");
  const down = s.puzzle.slots.filter((slot) => slot.direction === "down");
  const horizontal = across.find((slot) =>
    slot.cells.some((i) => down.some((other) => other.cells.includes(i))),
  );
  const crossing = horizontal.cells.find((i) =>
    down.some((slot) => slot.cells.includes(i)),
  );
  const before = horizontal.cells.find((i) => i !== crossing);
  const cell = (i: number) =>
    page.getByRole("textbox", {
      name: `Fila ${Math.floor(i / s.puzzle.size) + 1}, columna ${(i % s.puzzle.size) + 1}`,
      exact: true,
    });
  const activate = (i: number) => (touch ? cell(i).tap() : cell(i).click());
  await page
    .locator(".crossword-clues section")
    .first()
    .getByRole("button")
    .nth(across.indexOf(horizontal))
    .click();
  await cell(before).focus();
  await expect(cell(before)).toBeFocused();
  await activate(crossing);
  await expect(page.locator(".crossword-active strong")).toContainText(
    "Horizontal",
  );
  for (let i = 0; i < 8; i++) {
    await activate(crossing);
    await expect(page.locator(".crossword-active strong")).toContainText(
      i % 2 === 0 ? "Vertical" : "Horizontal",
    );
  }
  await cell(crossing).press("Enter");
  await expect(page.locator(".crossword-active strong")).toContainText(
    "Vertical",
  );
  await page
    .getByRole("button", { name: "Cambiar dirección ↔", exact: true })
    .click();
  await expect(page.locator(".crossword-active strong")).toContainText(
    "Horizontal",
  );
  await expect(cell(crossing)).toBeFocused();
}

test("crossword clicks select once and repeated clicks toggle exactly once", async ({
  page,
}) => {
  await checkCrossing(page);
});
test.describe("touch crossword", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("taps preserve the first orientation and toggle once per subsequent tap", async ({
    page,
  }) => {
    await checkCrossing(page, true);
  });
});
test("letter ring shows missed answers immediately and lets you review them after reloading", async ({
  page,
}) => {
  await choose(page, "Ronda de letras");
  await page
    .getByRole("combobox", { name: "Tiempo", exact: true })
    .selectOption("0");
  await start(page);
  const original = await state(page, "ring");
  const q = original.questions[original.index];
  await page
    .getByRole("textbox", { name: "Tu respuesta", exact: true })
    .fill("una respuesta equivocada");
  await page.getByRole("button", { name: "Responder", exact: true }).click();
  await expect(page.locator(".ring-answer-feedback")).toContainText(q.w);
  const missed = page.getByRole("button", {
    name: `${q.letter.toUpperCase()}: Fallo`,
    exact: true,
  });
  await missed.click();
  await expect(page.locator(".ring-solution strong")).toHaveText(q.w);
  await expect(page.locator(".question-card h2")).toHaveText(q.g);
  await page
    .getByRole("button", { name: "Seguir jugando", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Tu respuesta", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pausa Ⅱ", exact: true }).click();
  await page.reload();
  await page
    .locator(".game-card")
    .filter({
      has: page.getByRole("heading", { name: "Ronda de letras", exact: true }),
    })
    .getByRole("button", { name: /pendiente/ })
    .click();
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
  await missed.click();
  await expect(page.locator(".ring-solution strong")).toHaveText(q.w);
  expect((await state(page, "ring")).moves).toBe(1);
  await page
    .getByRole("button", { name: "Seguir jugando", exact: true })
    .click();
  for (let i = 1; i < original.questions.length; i++) {
    await page
      .getByRole("button", { name: "Revelar (fallo)", exact: true })
      .click();
  }
  await expect(page.locator(".answer-list li")).toHaveCount(
    original.questions.length,
  );
  await missed.click();
  await expect(page.locator(".ring-solution strong")).toHaveText(q.w);
  await page
    .getByRole("button", { name: "Ver todas las respuestas", exact: true })
    .click();
  await expect(page.locator(".answer-list")).toContainText(q.w);
});
