import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".bin": "application/octet-stream",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Serve build files with the headers a static host reads from dist/_headers. */
export async function staticServer(directory = "dist") {
  const root = resolve(directory);
  const headers = Object.fromEntries(
    (await readFile(resolve(root, "_headers"), "utf8"))
      .split(/\r?\n/)
      .filter((line) => /^\s+[^:]+:/.test(line))
      .map((line) => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
  );
  const overrides = new Map<string, string>();
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(
        new URL(request.url!, "http://localhost").pathname,
      );
      const path = resolve(root, "." + (name === "/" ? "/index.html" : name));
      if (!path.startsWith(root + sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const data = overrides.get(name) ?? (await readFile(path));
      response.writeHead(200, {
        ...headers,
        "Content-Type": types[extname(path)] ?? "application/octet-stream",
        "Cache-Control": name.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      response.end(request.method === "HEAD" ? undefined : data);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No server port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    overrides,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      }),
  };
}
