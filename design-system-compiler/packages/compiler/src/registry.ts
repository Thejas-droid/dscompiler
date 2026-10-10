import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DiagnosticBag } from "./diagnostics.js";
import type { ComponentManifest, InstalledComponentState, RegistryItem, RegistryState, TokenNode } from "./types.js";
import { safeJoin, stableStringify } from "./utils.js";

export interface RegistryLoadResult {
  items: Map<string, RegistryItem>;
  diagnostics: DiagnosticBag;
}

export async function loadRegistry(directory: string, tokens?: Map<string, TokenNode>): Promise<RegistryLoadResult> {
  const diagnostics = new DiagnosticBag();
  const items = new Map<string, RegistryItem>();
  let entries: string[] = [];
  try { entries = await readdir(directory); } catch { return { items, diagnostics }; }
  for (const entry of entries.sort()) {
    const itemDir = safeJoin(directory, entry);
    let s;
    try { s = await stat(itemDir); } catch { continue; }
    if (!s.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(path.join(itemDir, "manifest.json"), "utf8")) as ComponentManifest;
      if (!manifest.name || !manifest.version || !Array.isArray(manifest.files)) throw new Error("manifest requires name, version and files[]");
      for (const file of manifest.files) safeJoin(itemDir, file);
      items.set(manifest.name, { manifest, directory: itemDir });
    } catch (error) {
      diagnostics.error("COMPONENT_NOT_FOUND", `Invalid registry item \"${entry}\": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const [name, item] of items) {
    for (const dep of item.manifest.registryDependencies ?? []) if (!items.has(dep)) diagnostics.error("UNKNOWN_COMPONENT_DEPENDENCY", `Component \"${name}\" depends on unknown registry item \"${dep}\".`);
    if (tokens) for (const tokenName of item.manifest.tokens ?? []) {
      const token = tokens.get(tokenName);
      if (!token) diagnostics.error("TOKEN_REFERENCE_MISSING", `Component \"${name}\" references unknown token \"${tokenName}\".`, { token: tokenName });
      else if (token.sourceKind === "primitive") diagnostics.warn("PRIMITIVE_TOKEN_IN_COMPONENT", `Component \"${name}\" directly references primitive token \"${tokenName}\".`, { token: tokenName });
      if (token?.deprecated) diagnostics.warn("DEPRECATED_TOKEN", `Component \"${name}\" uses deprecated token \"${tokenName}\".`, { token: tokenName });
    }
  }
  detectComponentCycles(items, diagnostics);
  return { items, diagnostics };
}

export function resolveRegistryDependencies(items: Map<string, RegistryItem>, requested: string[]): RegistryItem[] {
  const result: RegistryItem[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (name: string): void => {
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new Error(`COMPONENT_DEPENDENCY_CYCLE: ${[...visiting, name].join(" -> ")}`);
    const item = items.get(name);
    if (!item) throw new Error(`COMPONENT_NOT_FOUND: ${name}`);
    visiting.add(name);
    for (const dep of [...(item.manifest.registryDependencies ?? [])].sort()) visit(dep);
    visiting.delete(name);
    visited.add(name);
    result.push(item);
  };
  for (const name of requested) visit(name);
  return result;
}

export interface InstallPlanFile { source: string; target: string; hash: string; component: string; modified: boolean }
export interface InstallPlan { files: InstallPlanFile[]; components: RegistryItem[]; packageDependencies: string[]; conflicts: InstallPlanFile[] }

export async function planInstall(registryDir: string, consumerDir: string, requested: string[]): Promise<InstallPlan> {
  const loaded = await loadRegistry(registryDir);
  if (loaded.diagnostics.hasErrors()) throw new Error(loaded.diagnostics.items.map((d) => d.message).join("\n"));
  const components = resolveRegistryDependencies(loaded.items, requested);
  const state = await readRegistryState(consumerDir, registryDir);
  const files: InstallPlanFile[] = [];
  const deps = new Set<string>();
  for (const item of components) {
    for (const dep of item.manifest.dependencies ?? []) deps.add(dep);
    for (const relative of item.manifest.files) {
      const source = safeJoin(item.directory, relative);
      const target = safeJoin(path.join(consumerDir, "components", "ui"), relative);
      const content = await readFile(source);
      const digest = sha(content);
      let modified = false;
      try {
        const current = await readFile(target);
        const installedHash = state.components[item.manifest.name]?.files[relative];
        modified = Boolean(installedHash && sha(current) !== installedHash);
      } catch { /* target missing */ }
      files.push({ source, target, hash: digest, component: item.manifest.name, modified });
    }
  }
  return { files, components, packageDependencies: [...deps].sort(), conflicts: files.filter((f) => f.modified) };
}

export async function applyInstall(plan: InstallPlan, consumerDir: string, registryDir: string, options: { force?: boolean; dryRun?: boolean } = {}): Promise<RegistryState> {
  const state = await readRegistryState(consumerDir, registryDir);
  if (plan.conflicts.length && !options.force) throw new Error(`Local modifications detected:\n${plan.conflicts.map((f) => f.target).join("\n")}\nUse --force to overwrite.`);
  for (const file of plan.files) {
    if (!options.dryRun) {
      await mkdir(path.dirname(file.target), { recursive: true });
      await writeFile(file.target, await readFile(file.source));
    }
  }
  for (const item of plan.components) {
    const files: Record<string, string> = {};
    for (const relative of item.manifest.files) {
      const planned = plan.files.find((f) => f.component === item.manifest.name && path.basename(f.source) === path.basename(relative));
      if (planned) files[relative] = planned.hash;
    }
    state.components[item.manifest.name] = { version: item.manifest.version, files };
  }
  state.registry = registryDir;
  if (!options.dryRun) await writeRegistryState(consumerDir, state);
  return state;
}

export async function readRegistryState(consumerDir: string, registry: string): Promise<RegistryState> {
  const file = path.join(consumerDir, "ds.config.json");
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    const components = (data.components && typeof data.components === "object" ? data.components : {}) as Record<string, unknown>;
    const normalized: Record<string, InstalledComponentState> = {};
    for (const [name, value] of Object.entries(components)) {
      if (typeof value === "string") normalized[name] = { version: value, files: {} };
      else if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        normalized[name] = { version: String(v.version ?? "0.0.0"), files: (v.files && typeof v.files === "object" ? v.files : {}) as Record<string, string> };
      }
    }
    return { registry: typeof data.registry === "string" ? data.registry : registry, components: normalized };
  } catch { return { registry, components: {} }; }
}

async function writeRegistryState(consumerDir: string, state: RegistryState): Promise<void> {
  const file = path.join(consumerDir, "ds.config.json");
  let base: Record<string, unknown> = {};
  try { base = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>; } catch { /* new */ }
  base.registry = state.registry;
  base.components = state.components;
  await writeFile(file, `${stableStringify(base)}\n`, "utf8");
}

function detectComponentCycles(items: Map<string, RegistryItem>, diagnostics: DiagnosticBag): void {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visit = (name: string): void => {
    const s = state.get(name) ?? 0;
    if (s === 2) return;
    if (s === 1) {
      const start = stack.indexOf(name);
      diagnostics.error("COMPONENT_DEPENDENCY_CYCLE", "Component dependency cycle detected.", { details: [[...stack.slice(start), name].join(" -> ")] });
      return;
    }
    state.set(name, 1); stack.push(name);
    for (const dep of items.get(name)?.manifest.registryDependencies ?? []) if (items.has(dep)) visit(dep);
    stack.pop(); state.set(name, 2);
  };
  for (const name of items.keys()) visit(name);
}
function sha(content: Buffer): string { return createHash("sha256").update(content).digest("hex"); }
