import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";
import { securityPolicy } from "./scripts/security-policy.ts";

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify("0.1.0") },
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
    securityPolicy(),
    ...(mode === "portable"
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: "prompt",
            manifest: {
              name: "Timeout",
              short_name: "Timeout",
              description: "Pausa y juega. Offline games.",
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
              ],
            },
            workbox: {
              clientsClaim: true,
              globPatterns: ["**/*.{js,css,html,svg,woff2,bin,wasm}"],
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
