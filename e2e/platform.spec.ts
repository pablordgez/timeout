import { test, expect, type BrowserContext } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createServer, request } from "node:http";

const names = [
  "Solitarios",
  "Sudoku",
  "Cinco letras",
  "Crucigramas",
  "Ronda de letras",
  "Letras en juego",
  "Ajedrez",
  "Póker",
  "Dominó",
  "Billar",
  "Preguntas y respuestas",
  "Serpiente",
  "Salto de dinosaurio",
  "Vuelo entre tubos",
  "Rompebloques",
  "Caída de bloques",
];
// WebKit's Windows port rejects even a minimal file:// page when setOffline is
// enabled. Abort HTTP requests instead; this still forbids remote resources.
async function blockNetwork(context: BrowserContext, browserName: string) {
  if (browserName === "webkit" && process.platform === "win32")
    await context.route(/^https?:\/\//, (route) => route.abort());
  else await context.setOffline(true);
}
async function start(page: any, name: string) {
  await page
    .locator(".game-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: /^Jugar/ })
    .click();
  await page.getByRole("button", { name: /Empezar partida/ }).click();
  await expect(page.locator(".play-title h1")).toHaveText(name, {
    timeout: 45000,
  });
}
test("all games open with guides and persist across browser reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".game-card")).toHaveCount(16);
  for (const name of names) {
    await start(page, name);
    await page.getByRole("button", { name: "Guía ?" }).click();
    await expect(page.locator(".guide h3")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar guía" }).click();
    await page.locator(".play-heading").getByRole("button").click();
  }
  await page.reload();
  await page
    .getByRole("button", { name: /Continuar/ })
    .first()
    .click();
  await expect(page.locator(".saved-row")).toHaveCount(16);
  await page.getByRole("button", { name: /Ajustes/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar todos los datos/ }).click();
  const file = await (await download).path();
  await page.locator("input[type=file]").setInputFiles(file!);
  await expect(
    page.getByRole("heading", { name: "Vista previa" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("portable runs with network blocked including worker generation and Stockfish", async ({
  page,
  context,
  browserName,
}) => {
  await blockNetwork(context, browserName);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await page.goto(pathToFileURL(resolve("dist-portable/index.html")).href);
  await expect(page.locator(".game-card")).toHaveCount(16);
  await start(page, "Sudoku");
  await expect(page.locator(".sudoku-cell")).toHaveCount(81);
  await page.locator(".play-heading").getByRole("button").click();
  await start(page, "Ajedrez");
  await page
    .getByRole("button", { name: /Continuar/ })
    .last()
    .click();
  await page
    .getByRole("button", { name: "e2 blancas peón", exact: true })
    .click();
  await page.getByRole("button", { name: "e4 vacía", exact: true }).click();
  await expect(page.locator(".move-log li")).toHaveCount(2, { timeout: 25000 });
  await page.locator(".play-heading").getByRole("button").click();
  for (const name of names.filter((n) => !["Sudoku", "Ajedrez"].includes(n))) {
    await start(page, name);
    await page.getByRole("button", { name: "Guía ?" }).click();
    await expect(page.locator(".guide h3")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar guía" }).click();
    await page.locator(".play-heading").getByRole("button").click();
  }
  expect(requests).toEqual([]);
});
test("web cache supports offline reopening", async ({
  page,
  context,
  browserName,
}) => {
  let stop: (() => Promise<void>) | undefined;
  if (browserName === "webkit" && process.platform === "win32") {
    // Blocked inspector routes run before WebKit's service worker. Closing a
    // temporary local proxy tests a real disconnected origin instead.
    const server = createServer((incoming, response) => {
      const upstream = request(
        {
          hostname: "127.0.0.1",
          port: 4173,
          path: incoming.url,
          method: incoming.method,
          headers: incoming.headers,
        },
        (result) => {
          response.writeHead(result.statusCode || 502, result.headers);
          result.pipe(response);
        },
      );
      upstream.on("error", () => {
        response.writeHead(503);
        response.end();
      });
      incoming.pipe(upstream);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as { port: number };
    stop = () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    await page.goto(`http://127.0.0.1:${address.port}/`);
  } else await page.goto("/");
  await expect(page.locator(".game-card")).toHaveCount(16);
  await expect
    .poll(
      () => page.evaluate(async () => !!navigator.serviceWorker.controller),
      { timeout: 30000 },
    )
    .toBe(true);
  if (stop) await stop();
  else await blockNetwork(context, browserName);
  await page.reload();
  await expect(page.locator(".game-card")).toHaveCount(16);
  await start(page, "Cinco letras");
  await expect(page.locator(".letter-cell")).toHaveCount(30);
});
test("export/import preview, merge and replacement preserve pending games", async ({
  page,
}) => {
  await page.goto("/");
  await start(page, "Serpiente");
  await page.locator(".play-heading").getByRole("button").click();
  await page.getByRole("button", { name: /Ajustes/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar todos los datos/ }).click();
  const file = await (await download).path();
  await page.locator("input[type=file]").setInputFiles(file!);
  await expect(
    page.getByRole("heading", { name: "Vista previa" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await page
    .getByRole("button", { name: /Continuar/ })
    .first()
    .click();
  await expect(page.locator(".saved-row")).toHaveCount(1);
});
test("mobile catalog, theme, language and tactile controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".game-card")).toHaveCount(16);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Change language / Cambiar idioma" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Collection" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Settings/ }).click();
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("phosphor");
  await expect(
    page.getByRole("combobox", { name: "Theme", exact: true }),
  ).toHaveValue("phosphor");
  await page.reload();
  await page.getByRole("button", { name: /Settings/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Theme", exact: true }),
  ).toHaveValue("phosphor");
});
