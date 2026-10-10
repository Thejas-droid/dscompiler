import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DiagnosticBag, CompilerError } from "./diagnostics.js";
import { parseTokenFile } from "./parser.js";
import { resolveTokenGraph, resolveTokenGraphIncremental } from "./graph.js";
import { loadThemes } from "./themes.js";
import { generateArtifacts } from "./generators.js";
import { analyzeContrast } from "./contrast.js";
import { loadRegistry } from "./registry.js";
import type { CompileResult, CompilerConfig, Generator, TokenNode } from "./types.js";
import { hash, stableStringify, writeIfChanged } from "./utils.js";

export interface CompileOptions { cwd?: string; emit?: boolean; failOnWarnings?: boolean; cache?: boolean; generators?: Generator[]; previous?: CompileResult }

export async function compile(config: CompilerConfig, options: CompileOptions = {}): Promise<CompileResult> {
  const start = performance.now();
  const diagnostics = new DiagnosticBag();
  const tokens = new Map<string, TokenNode>();
  const inputChunks: string[] = [stableStringify(config), "compiler:0.1.0", ...(options.generators ?? []).map((g) => `generator:${g.name}@${g.version ?? "0"}`)];

  for (const file of [...config.tokens].sort()) {
    const text = await readFile(file, "utf8");
    inputChunks.push(file, text);
    const sourceKind: TokenNode["sourceKind"] = /semantic/i.test(path.basename(file)) ? "semantic" : /primitive/i.test(path.basename(file)) ? "primitive" : "unknown";
    const parsed = await parseTokenFile(file, sourceKind);
    diagnostics.merge(parsed.diagnostics);
    for (const [name, token] of parsed.tokens) {
      if (tokens.has(name)) diagnostics.error("TOKEN_SCHEMA_INVALID", `Duplicate token \"${name}\".`, { token: name, source: token.source });
      else tokens.set(name, token);
    }
  }
  if (config.themes) {
    try {
      const { readdir } = await import("node:fs/promises");
      for (const name of (await readdir(config.themes)).filter((x) => /\.(json|jsonc|ya?ml)$/i.test(x)).sort()) inputChunks.push(name, await readFile(path.join(config.themes, name), "utf8"));
    } catch { /* no themes */ }
  }
  if (config.registry) {
    try {
      const { readdir } = await import("node:fs/promises");
      for (const dir of (await readdir(config.registry)).sort()) {
        try { inputChunks.push(`manifest:${dir}`, await readFile(path.join(config.registry, dir, "manifest.json"), "utf8")); } catch { /* ignored */ }
      }
    } catch { /* no registry */ }
  }
  const inputHash = hash(inputChunks.join("\n\0\n"));
  const outDir = config.outDir ?? path.resolve(options.cwd ?? process.cwd(), "dist");
  const cacheFile = path.join(path.dirname(outDir), ".dsc-cache.json");
  let previousHash: string | undefined;
  if (options.cache !== false) {
    try { previousHash = (JSON.parse(await readFile(cacheFile, "utf8")) as { inputHash?: string }).inputHash; } catch { /* no cache */ }
  }

  const graph = options.previous ? resolveTokenGraphIncremental(tokens, options.previous.tokens) : resolveTokenGraph(tokens);
  diagnostics.merge(graph.diagnostics);
  const projectRoot = path.resolve(options.cwd ?? path.dirname(config.outDir ?? process.cwd()));
  for (const token of graph.tokens.values()) {
    if (path.isAbsolute(token.source.file)) token.source.file = path.relative(projectRoot, token.source.file).split(path.sep).join("/");
  }
  for (const item of diagnostics.items) {
    if (item.source && path.isAbsolute(item.source.file)) item.source.file = path.relative(projectRoot, item.source.file).split(path.sep).join("/");
  }
  const themeResult = config.themes ? await loadThemes(config.themes, graph.tokens) : { themes: new Map(), diagnostics: new DiagnosticBag() };
  diagnostics.merge(themeResult.diagnostics);

  let componentMetadata: unknown[] = [];
  if (config.registry) {
    const registry = await loadRegistry(config.registry, graph.tokens);
    diagnostics.merge(registry.diagnostics);
    componentMetadata = [...registry.items.values()].map((x) => x.manifest).sort((a, b) => a.name.localeCompare(b.name));
  }

  if (config.contrastPairs?.length) diagnostics.merge(analyzeContrast(graph.tokens, themeResult.themes, config.contrastPairs).diagnostics);
  const generated = generateArtifacts(graph.tokens, themeResult.themes, config, componentMetadata);
  for (const generator of options.generators ?? []) {
    const extra = await generator.generate({ tokens: graph.tokens, themes: themeResult.themes, config, metadata: generated.metadata });
    generated.artifacts.push(...extra);
  }
  generated.artifacts.sort((a, b) => a.path.localeCompare(b.path));
  const cacheHit = previousHash === inputHash;

  if (options.emit !== false && !diagnostics.hasErrors()) {
    for (const artifact of generated.artifacts) await writeIfChanged(path.join(outDir, artifact.path), artifact.content);
    if (options.cache !== false) await writeFile(cacheFile, `${stableStringify({ inputHash, artifacts: Object.fromEntries(generated.artifacts.map((a) => [a.path, hash(a.content)])) })}\n`, "utf8");
  }

  const result: CompileResult = {
    tokens: graph.tokens,
    themes: themeResult.themes,
    diagnostics: diagnostics.items,
    artifacts: generated.artifacts,
    metadata: generated.metadata,
    inputHash,
    durationMs: performance.now() - start,
    cacheHit
  };
  if (options.failOnWarnings && diagnostics.items.some((d) => d.severity === "warning")) throw new CompilerError(diagnostics.items);
  return result;
}

export function assertCompileSuccess(result: CompileResult): void {
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  if (errors.length) throw new CompilerError(errors);
}
