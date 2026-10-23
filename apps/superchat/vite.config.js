import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/acodex/",
  css: { postcss: { plugins: [] } },
  server: { port: 5174 },
});
