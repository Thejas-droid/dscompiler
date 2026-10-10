import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { designSystem } from "@dsc/enforcer/vite";
export default defineConfig(({ mode }) => ({
  plugins: [
    designSystem({
      devMode: mode === "strict" ? "strict" : "warn",
      failOnWarnings: true,
    }),
    react(),
  ],
  server: { port: 5175, strictPort: true },
}));
