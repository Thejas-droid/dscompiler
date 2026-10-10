import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
// Figma loads ui.html in a sandbox without an HTTP asset server.
function inlinePluginUi(): Plugin {
  return {
    name: "figma-inline-ui",
    enforce: "post",
    generateBundle(_, bundle) {
      const html = bundle["ui.html"];
      if (!html || html.type !== "asset")
        throw new Error("Figma UI HTML missing.");
      let source = String(html.source);
      source = source.replace(
        /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
        (_tag, url: string) => {
          const key = url.replace(/^\//, "");
          const chunk = bundle[key];
          if (!chunk || chunk.type !== "chunk")
            throw new Error(`UI script missing: ${key}`);
          return `<script type="module">${chunk.code.replace(/<\/script/gi, "<\\/script")}</script>`;
        },
      );
      source = source.replace(
        /<link\b[^>]*href="([^"]+\.css)"[^>]*>/g,
        (_tag, url: string) => {
          const key = url.replace(/^\//, "");
          const asset = bundle[key];
          if (!asset || asset.type !== "asset")
            throw new Error(`UI stylesheet missing: ${key}`);
          return `<style>${String(asset.source)}</style>`;
        },
      );
      html.source = source;
    },
  };
}
export default defineConfig({
  plugins: [react(), inlinePluginUi()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(here, "ui.html"),
      output: { inlineDynamicImports: true },
    },
  },
});
