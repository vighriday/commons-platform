import { URL, fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// COMMONS frontend build config.
// - Builds the React SPA into dist/ (served by the Express server in production).
// - Tailwind v4 runs via its Vite plugin (no postcss config needed).
// - In production the Express server serves the build; in development the server
//   mounts Vite as middleware, so the browser always talks to one origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
  },
});
