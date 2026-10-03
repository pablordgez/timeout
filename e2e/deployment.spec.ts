import { test, expect, type Page } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { staticServer } from "./support/static-server";
const packageInfo = JSON.parse(await readFile("package.json", "utf8"));

async function cached(page: Page) {
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 30000,
    })
    .toBe(true);
}
async function start(page: Page, name: string) {
  await page
    .locator(".game-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: /^Jugar/ })
    .click();
  await page.getByRole("button", { name: /Empezar partida/ }).click();
  await expect(page.locator(".play-title h1")).toHaveText(name);
}
async function savedSessions(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((done, reject) => {
        const open = indexedDB.open("timeout");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction("data").objectStore("data").get("main");
          get.onerror = () => {
            reject(get.error);
            db.close();
          };
          get.onsuccess = () => {
            done(get.result.sessions);
            db.close();
          };
        };
      }),
  );
}

test("static hosting applies security headers and supplies mobile icons without duplicate dictionaries", async ({
  page,
  request,
  browserName,
}) => {
  const host = await staticServer();
  try {
    const violations: string[] = [];
    page.on("pageerror", (error) => violations.push(error.message));
    await page.addInitScript(() => {
      (window as any).policyViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as any).policyViolations.push(event.violatedDirective);
      });
    });
    const response = await page.goto(host.url);
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["content-security-policy"]).not.toContain("'unsafe-eval'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["permissions-policy"]).toContain("camera=()");
    await expect(page.locator(".game-card")).toHaveCount(16);
    const manifest = await (
      await request.get(host.url + "/manifest.webmanifest")
    ).json();
    expect(manifest.lang).toBe("es");
    for (const size of [192, 512]) {
      const icon = manifest.icons.find(
        (item: any) => item.sizes === `${size}x${size}`,
      );
      expect(icon.type).toBe("image/png");
      expect(icon.purpose).toContain("maskable");
      const dimensions = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, icon.src);
      expect(dimensions).toEqual([size, size]);
    }
    const apple = await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute("href");
    expect(
      (await request.get(new URL(apple!, host.url).href)).headers()[
        "content-type"
      ],
    ).toBe("image/png");
    const assets = await readdir("dist/assets");
    expect(
      assets.filter((name) => /^(es|en)\.json-.*\.bin$/.test(name)),
    ).toHaveLength(2);
    expect(assets.filter((name) => name.endsWith(".gz"))).toEqual([]);
    await cached(page);
    if (browserName === "chromium") {
      const session = await page.context().newCDPSession(page);
      const result = await session.send("Page.getInstallabilityErrors");
      expect(result.installabilityErrors).toEqual([]);
      await session.detach();
    }
    await start(page, "Crucigramas");
    await expect(page.locator(".crossword-cell")).not.toHaveCount(0);
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
    await expect(page.locator(".move-log li")).toHaveCount(2, {
      timeout: 25000,
    });
    expect(await page.evaluate(() => (window as any).policyViolations)).toEqual(
      [],
    );
    expect(violations).toEqual([]);
    if (browserName === "chromium") {
      const wrapper = await page.context().newPage();
      const blocked = wrapper.waitForEvent("console", {
        predicate: (message) => message.text().includes("frame-ancestors"),
        timeout: 15000,
      });
      await wrapper.setContent(`<iframe src="${host.url}/"></iframe>`, {
        waitUntil: "domcontentloaded",
      });
      await blocked;
      await wrapper.close();
    }
  } finally {
    await host.close();
  }
});

test("static deployment updates safely and reopens games after the server goes offline", async ({
  page,
}) => {
  const host = await staticServer();
  try {
    const html = await readFile("dist/index.html", "utf8");
    const sw = await readFile("dist/sw.js", "utf8");
    host.overrides.set(
      "/",
      html.replace("Timeout — juegos", "Timeout — previa"),
    );
    host.overrides.set(
      "/index.html",
      html.replace("Timeout — juegos", "Timeout — previa"),
    );
    host.overrides.set(
      "/sw.js",
      sw.replace(/(url:"index.html",revision:")[^"]+/, "$1previous-deployment"),
    );
    await page.goto(host.url);
    await cached(page);
    await start(page, "Serpiente");
    await page.locator(".play-heading").getByRole("button").click();
    const savedBefore = await savedSessions(page);
    expect(savedBefore).toHaveLength(1);
    host.overrides.clear();
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect(
      page.getByRole("button", { name: "Actualizar", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page).toHaveTitle("Timeout — juegos");
    await page
      .getByRole("button", { name: /Continuar/ })
      .first()
      .click();
    await expect(page.locator(".saved-row")).toHaveCount(1);
    await expect(page.locator(".saved-row")).toContainText("Serpiente");
    expect(await savedSessions(page)).toEqual(savedBefore);
    await page
      .getByRole("button", { name: /Colección/ })
      .first()
      .click();
    const cachedIcons = await page.evaluate(async () => {
      const keys = await caches.keys();
      const urls = (
        await Promise.all(
          keys.map(async (key) =>
            (await (await caches.open(key)).keys()).map(
              (request) => request.url,
            ),
          ),
        )
      ).flat();
      return urls.filter((url) => /icon-(192|512)\.png/.test(url));
    });
    expect(cachedIcons).toHaveLength(2);
    await host.close();
    await page.reload();
    await expect(page.locator(".game-card")).toHaveCount(16);
    await start(page, "Crucigramas");
    await expect(page.locator(".crossword-cell")).not.toHaveCount(0);
    await page.locator(".play-heading").getByRole("button").click();
    await page.getByRole("button", { name: "Créditos y licencias" }).click();
    await expect(
      page.getByRole("link", {
        name: "Descargas y código fuente correspondiente",
      }),
    ).toHaveAttribute(
      "href",
      `https://github.com/pablordgez/timeout/releases/tag/v${packageInfo.version}`,
    );
  } finally {
    await host.close();
  }
});
