import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";
import { securityPolicy } from "./scripts/security-policy.ts";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: "./",
  server: {
    watch: {
      ignored: [
        "**/.cache/**",
        "**/test-results/**",
        "**/dist/**",
        "**/dist-portable/**",
        "**/playwright-report/**",
        "**/output/**",
      ],
    },
  },
  plugins: [
    react(),
    {
      name: "timeout-portable-icons",
      transformIndexHtml: (html) =>
        mode === "portable"
          ? html.replace(/<link rel="apple-touch-icon"[^>]+>/, "")
          : html,
    },
    securityPolicy(),
    ...(mode === "portable"
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: "prompt",
            manifest: {
              name: "Timeout",
              short_name: "Timeout",
              description: "16 juegos de cartas, palabras, tablero y arcade.",
              lang: "es",
              theme_color: "#ee353b",
              background_color: "#121314",
              display: "standalone",
              start_url: "./",
              icons: [
                {
                  src: "icon.svg",
                  sizes: "any",
                  type: "image/svg+xml",
                  purpose: "any",
                },
                {
                  src: "icon-192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "any maskable",
                },
                {
                  src: "icon-512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any maskable",
                },
              ],
            },
            workbox: {
              clientsClaim: true,
              globPatterns: ["**/*.{js,css,html,svg,png,woff2,bin,wasm}"],
              maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
              navigateFallback: "index.html",
            },
          }),
        ]),
  ],
  build: {
    rollupOptions: {
      output: {
        // Application-owned gzip data must not be decoded by the HTTP server.
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith(".gz"))
            ? "assets/[name]-[hash].bin"
            : "assets/[name]-[hash][extname]",
      },
    },
    outDir: mode === "portable" ? "dist-portable" : "dist",
    assetsInlineLimit: mode === "portable" ? 100000000 : 4096,
    chunkSizeWarningLimit: 40000,
  },
  worker: { format: "iife" },
}));
