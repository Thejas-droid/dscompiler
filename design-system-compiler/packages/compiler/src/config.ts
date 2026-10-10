import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import type { CompilerConfig } from "./types.js";

export function defineConfig(config: CompilerConfig): CompilerConfig { return config; }

export async function loadConfig(cwd = process.cwd(), explicit?: string): Promise<{ config: CompilerConfig; file: string }> {
  const candidates = explicit ? [explicit] : ["ds.config.ts", "ds.config.mts", "ds.config.mjs", "ds.config.js", "ds.config.json"];
  for (const candidate of candidates) {
    const file = path.resolve(cwd, candidate);
    try { await access(file); } catch { continue; }
    if (file.endsWith(".json")) return { config: JSON.parse(await readFile(file, "utf8")) as CompilerConfig, file };
    if (/\.m?js$/.test(file)) {
      const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`) as { default?: CompilerConfig };
      if (!mod.default) throw new Error(`${file} must export default a config object.`);
      return { config: mod.default, file };
    }
    if (/\.m?ts$/.test(file)) {
      const source = await readFile(file, "utf8");
      const stripped = source.replace(/^\s*import\s+\{?\s*defineConfig\s*\}?\s+from\s+["'][^"']+["'];?\s*$/gm, "");
      const compiled = ts.transpileModule(stripped, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
      const body = compiled.replace(/export\s+default\s+defineConfig\s*\(/, "export default (");
      const temp = path.join(cwd, `.ds.config.${process.pid}.mjs`);
      await writeFile(temp, body, "utf8");
      try {
        const mod = await import(`${pathToFileURL(temp).href}?t=${Date.now()}`) as { default?: CompilerConfig };
        if (!mod.default) throw new Error(`${file} must export default a config object.`);
        return { config: mod.default, file };
      } finally {
        const { rm } = await import("node:fs/promises");
        await rm(temp, { force: true });
      }
    }
  }
  throw new Error(`No ds.config file found in ${cwd}. Run \"ds init\" first.`);
}

export function resolveConfigPaths(config: CompilerConfig, configFile: string): CompilerConfig {
  const cwd = path.dirname(configFile);
  return {
    ...config,
    tokens: config.tokens.map((p) => path.resolve(cwd, p)),
    ...(config.themes ? { themes: path.resolve(cwd, config.themes) } : {}),
    ...(config.registry ? { registry: path.resolve(cwd, config.registry) } : {}),
    ...(config.outDir ? { outDir: path.resolve(cwd, config.outDir) } : { outDir: path.resolve(cwd, "dist") })
  };
}
