import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // No includeAssets: the globPatterns below already cover everything in
      // public/, and listing them twice puts duplicate entries in the
      // precache manifest.
      manifest: {
        name: "Rural Bridge",
        short_name: "RuralBridge",
        description:
          "Cross-domain health and agriculture risk detection for rural blocks.",
        theme_color: "#2F5D3F",
        background_color: "#F6F8F3",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // The app shell is precached so a cold start with no signal still boots.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Read-only endpoints tolerate a stale answer; writes never touch the SW.
            urlPattern: /^\/api\/(blocks|correlations)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "rb-api",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5174",
    },
  },
  // `vite preview` serves the real production build with the real service
  // worker, which is the only configuration worth benchmarking. It needs the
  // same API proxy as the dev server.
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://127.0.0.1:5174",
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
