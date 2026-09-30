import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Hash the final inline scripts, including the single-file edition. */
export function securityPolicy(): Plugin {
  return {
    name: "timeout-security-policy",
    apply: "build",
    async writeBundle(options) {
      const directory = resolve(options.dir!);
      const path = resolve(directory, "index.html");
      const html = await readFile(path, "utf8");
      const hashes = [
        ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
      ]
        .filter(
          ([, attributes, code]) =>
            !/\bsrc\s*=/i.test(attributes) && code.trim(),
        )
        .map(
          ([, , code]) =>
            `'sha256-${createHash("sha256").update(code).digest("base64")}'`,
        );
      const policy = [
        "default-src 'none'",
        `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`.trim(),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
      ].join("; ");
      // Frame restrictions require an HTTP header; the other rules work in HTML too.
      await writeFile(
        path,
        html.replace(
          /<head>/i,
          `<head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">`,
        ),
      );
      await writeFile(
        resolve(directory, "_headers"),
        `/*\n  Content-Security-Policy: ${policy}; frame-ancestors 'none'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`,
      );
    },
  };
}
