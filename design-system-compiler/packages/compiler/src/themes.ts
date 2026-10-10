import { readdir } from "node:fs/promises";
import path from "node:path";
import { DiagnosticBag } from "./diagnostics.js";
import { extractReferences, flattenTokenData, parseTokenFile } from "./parser.js";
import { resolveTokenGraph } from "./graph.js";
import type { ResolvedTheme, ThemeDefinition, TokenNode, TokenType, TokenValue } from "./types.js";

export async function loadThemes(directory: string, baseTokens: Map<string, TokenNode>): Promise<{ themes: Map<string, ResolvedTheme>; diagnostics: DiagnosticBag }> {
  const diagnostics = new DiagnosticBag();
  const definitions = new Map<string, ThemeDefinition>();
  let entries: string[] = [];
  try { entries = await readdir(directory); } catch { return { themes: new Map(), diagnostics }; }
  for (const entry of entries.filter((name) => /\.(json|jsonc|ya?ml)$/i.test(name)).sort()) {
    const file = path.join(directory, entry);
    const parsed = await parseTokenFile(file, "theme");
    diagnostics.merge(parsed.diagnostics);
    const data = parsed.data as Record<string, unknown>;
    const name = typeof data.$name === "string" ? data.$name : entry.replace(/\.(json|jsonc|ya?ml)$/i, "");
    const ext = typeof data.$extends === "string" ? data.$extends : undefined;
    const overrides = collectThemeOverrides(data, file, baseTokens);
    definitions.set(name, { name, file, overrides, ...(ext ? { extends: ext } : {}) });
  }

  const themes = new Map<string, ResolvedTheme>();
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  const resolveTheme = (name: string): ResolvedTheme | undefined => {
    if (themes.has(name)) return themes.get(name);
    const def = definitions.get(name);
    if (!def) return undefined;
    const s = state.get(name) ?? 0;
    if (s === 1) {
      const start = stack.indexOf(name);
      diagnostics.error("THEME_CYCLE", "Theme inheritance cycle detected.", {
        details: [[...stack.slice(start), name].join(" -> ")]
      });
      return undefined;
    }
    if (s === 2) return themes.get(name);
    state.set(name, 1);
    stack.push(name);

    const inheritedRaw = new Map<string, TokenValue>();
    const inheritedOverrides = new Set<string>();
    if (def.extends) {
      const parent = resolveTheme(def.extends);
      if (!parent && !definitions.has(def.extends)) diagnostics.error("THEME_MISSING_TOKEN", `Theme \"${name}\" extends unknown theme \"${def.extends}\".`);
      if (parent) {
        for (const [tokenName, value] of parent.rawOverrides) inheritedRaw.set(tokenName, value);
        for (const tokenName of parent.overrides) inheritedOverrides.add(tokenName);
      }
    }

    const themedTokens = new Map<string, TokenNode>();
    for (const [tokenName, base] of baseTokens) {
      themedTokens.set(tokenName, { ...base, rawValue: inheritedRaw.has(tokenName) ? (inheritedRaw.get(tokenName) as TokenValue) : base.rawValue, value: inheritedRaw.has(tokenName) ? (inheritedRaw.get(tokenName) as TokenValue) : base.rawValue });
    }
    for (const [tokenName, override] of def.overrides) {
      const base = themedTokens.get(tokenName);
      if (!base) {
        diagnostics.error("THEME_UNKNOWN_TOKEN", `Theme \"${name}\" overrides unknown token \"${tokenName}\".`, { token: tokenName, source: override.source });
        continue;
      }
      if (override.type && override.type !== base.type) {
        diagnostics.error("TOKEN_TYPE_MISMATCH", `Theme override for \"${tokenName}\" changes type from ${base.type} to ${override.type}.`, { token: tokenName, source: override.source });
      }
      themedTokens.set(tokenName, {
        ...base,
        rawValue: override.rawValue,
        value: override.rawValue,
        references: override.references,
        source: override.source,
        sourceKind: "theme"
      });
      inheritedOverrides.add(tokenName);
    }
    const graph = resolveTokenGraph(themedTokens);
    diagnostics.merge(graph.diagnostics);
    const values = new Map<string, TokenValue>();
    for (const [tokenName, token] of graph.tokens) {
      if (token.resolvedValue !== undefined) values.set(tokenName, token.resolvedValue);
      else diagnostics.error("THEME_MISSING_TOKEN", `Theme \"${name}\" could not resolve \"${tokenName}\".`, { token: tokenName, source: token.source });
    }

    const rawOverrides = new Map(inheritedRaw);
    for (const [tokenName, override] of def.overrides) rawOverrides.set(tokenName, override.rawValue);
    const result: ResolvedTheme = { name, values, overrides: inheritedOverrides, rawOverrides, ...(def.extends ? { extends: def.extends } : {}) };
    themes.set(name, result);
    stack.pop();
    state.set(name, 2);
    return result;
  };

  for (const name of [...definitions.keys()].sort()) resolveTheme(name);
  return { themes, diagnostics };
}

function collectThemeOverrides(data: Record<string, unknown>, file: string, baseTokens: Map<string, TokenNode>): ThemeDefinition["overrides"] {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) if (!key.startsWith("$")) cleaned[key] = value;
  const flattened = flattenTokenData(cleaned, { file, sourceKind: "theme" });
  const result: ThemeDefinition["overrides"] = new Map();
  // Theme overrides are allowed to omit $type; recover those separately.
  const visit = (node: unknown, parts: string[]): void => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const rec = node as Record<string, unknown>;
    if ("$value" in rec) {
      const tokenPath = parts.join(".");
      const base = baseTokens.get(tokenPath);
      const value = rec.$value as TokenValue;
      result.set(tokenPath, {
        path: tokenPath,
        value,
        rawValue: value,
        references: extractReferences(value),
        source: { file, line: 1, column: 1 },
        ...(typeof rec.$type === "string" ? { type: rec.$type as TokenType } : base ? { type: base.type } : {})
      });
      return;
    }
    for (const [key, value] of Object.entries(rec)) if (!key.startsWith("$")) visit(value, [...parts, key]);
  };
  visit(cleaned, []);
  for (const [key, value] of flattened) result.set(key, value);
  return result;
}
