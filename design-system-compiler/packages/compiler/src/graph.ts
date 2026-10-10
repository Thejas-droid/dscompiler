import { DiagnosticBag } from "./diagnostics.js";
import { fullReferenceTarget, isFullReference } from "./parser.js";
import type { TokenNode, TokenValue } from "./types.js";
import { nearest } from "./utils.js";

export interface GraphResult {
  tokens: Map<string, TokenNode>;
  diagnostics: DiagnosticBag;
  dependencies: Map<string, Set<string>>;
  dependents: Map<string, Set<string>>;
}

export function resolveTokenGraph(input: Map<string, TokenNode>): GraphResult {
  const diagnostics = new DiagnosticBag();
  const tokens = new Map<string, TokenNode>();
  for (const [name, token] of input) tokens.set(name, { ...token, references: [...token.references] });
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  for (const [name, token] of tokens) {
    dependencies.set(name, new Set(token.references));
    for (const ref of token.references) {
      if (!dependents.has(ref)) dependents.set(ref, new Set());
      dependents.get(ref)?.add(name);
      if (!tokens.has(ref)) {
        const suggestion = nearest(ref, tokens.keys());
        diagnostics.error("TOKEN_REFERENCE_MISSING", `No token named \"${ref}\" exists.`, {
          token: name,
          source: token.source,
          details: [`references: {${ref}}`],
          ...(suggestion ? { suggestion } : {})
        });
      }
    }
  }

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const memo = new Map<string, TokenValue>();
  const reportedCycles = new Set<string>();

  const resolve = (name: string): TokenValue | undefined => {
    const token = tokens.get(name);
    if (!token) return undefined;
    const s = state.get(name) ?? 0;
    if (s === 2) return memo.get(name);
    if (s === 1) {
      const start = stack.indexOf(name);
      const cycle = [...stack.slice(start), name];
      const key = canonicalCycle(cycle);
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        diagnostics.error("TOKEN_CYCLE", `Circular token reference detected.`, {
          token: name,
          source: token.source,
          details: [cycle.join(" -> ")]
        });
      }
      return undefined;
    }
    state.set(name, 1);
    stack.push(name);

    if (isFullReference(token.rawValue)) {
      const targetName = fullReferenceTarget(token.rawValue);
      const target = targetName ? tokens.get(targetName) : undefined;
      if (target && target.type !== token.type) {
        diagnostics.error("TOKEN_TYPE_MISMATCH", `Alias type mismatch. Expected ${token.type}; received ${target.type}.`, {
          token: name,
          source: token.source,
          details: [`${name} -> ${targetName}`]
        });
      }
    }

    let value = deepResolve(token.rawValue, (ref) => resolve(ref));
    stack.pop();
    state.set(name, 2);
    if (value !== undefined) {
      memo.set(name, value);
      token.resolvedValue = value;
      token.value = value;
    }
    return value;
  };

  for (const name of [...tokens.keys()].sort()) resolve(name);
  return { tokens, diagnostics, dependencies, dependents };
}

function deepResolve(value: TokenValue, resolver: (name: string) => TokenValue | undefined): TokenValue | undefined {
  if (typeof value === "string") {
    const exact = fullReferenceTarget(value);
    if (exact) return resolver(exact);
    return value.replace(/\{([a-zA-Z0-9_.\-/]+)\}/g, (_match, ref: string) => stringifyInline(resolver(ref)));
  }
  if (Array.isArray(value)) {
    const result: TokenValue[] = [];
    for (const item of value) {
      const resolved = deepResolve(item as TokenValue, resolver);
      if (resolved === undefined) return undefined;
      result.push(resolved);
    }
    return result as unknown as TokenValue;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const resolved = deepResolve(item as TokenValue, resolver);
      if (resolved === undefined) return undefined;
      out[key] = resolved;
    }
    return out;
  }
  return value;
}

function stringifyInline(value: TokenValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function canonicalCycle(cycle: string[]): string {
  const body = cycle.slice(0, -1);
  if (!body.length) return cycle.join("->");
  const rotations = body.map((_, i) => [...body.slice(i), ...body.slice(0, i)].join("->"));
  return rotations.sort()[0] ?? cycle.join("->");
}

export function affectedTokens(changed: Iterable<string>, dependents: Map<string, Set<string>>): Set<string> {
  const result = new Set<string>();
  const queue = [...changed];
  while (queue.length) {
    const current = queue.shift();
    if (!current || result.has(current)) continue;
    result.add(current);
    for (const dep of dependents.get(current) ?? []) queue.push(dep);
  }
  return result;
}

export interface IncrementalGraphResult extends GraphResult {
  changed: Set<string>;
  affected: Set<string>;
  reused: number;
}

/**
 * Resolves only the transitive reverse-dependency closure of changed tokens.
 * Unaffected nodes reuse the previous resolved value byte-for-byte.
 */
export function resolveTokenGraphIncremental(
  input: Map<string, TokenNode>,
  previous: Map<string, TokenNode>,
  changedInput?: Iterable<string>
): IncrementalGraphResult {
  const changed = changedInput ? new Set(changedInput) : detectChangedTokens(previous, input);
  const diagnostics = new DiagnosticBag();
  const tokens = new Map<string, TokenNode>();
  for (const [name, token] of input) tokens.set(name, { ...token, references: [...token.references] });

  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  const oldDependents = new Map<string, Set<string>>();
  const addReverse = (target: Map<string, Set<string>>, from: string, refs: string[]) => {
    for (const ref of refs) {
      if (!target.has(ref)) target.set(ref, new Set());
      target.get(ref)?.add(from);
    }
  };
  for (const [name, token] of previous) addReverse(oldDependents, name, token.references);
  for (const [name, token] of tokens) {
    dependencies.set(name, new Set(token.references));
    addReverse(dependents, name, token.references);
    for (const ref of token.references) {
      if (!tokens.has(ref)) {
        const suggestion = nearest(ref, tokens.keys());
        diagnostics.error("TOKEN_REFERENCE_MISSING", `No token named \"${ref}\" exists.`, {
          token: name,
          source: token.source,
          details: [`references: {${ref}}`],
          ...(suggestion ? { suggestion } : {})
        });
      }
    }
  }
  const mergedDependents = new Map<string, Set<string>>();
  for (const source of [oldDependents, dependents]) {
    for (const [name, refs] of source) {
      if (!mergedDependents.has(name)) mergedDependents.set(name, new Set());
      for (const ref of refs) mergedDependents.get(name)?.add(ref);
    }
  }
  const affected = affectedTokens(changed, mergedDependents);
  // A removed token is not in the new map, but its consumers are still affected.
  for (const name of [...affected]) if (!tokens.has(name)) affected.delete(name);

  const state = new Map<string, 0 | 1 | 2>();
  const memo = new Map<string, TokenValue>();
  let reused = 0;
  for (const [name, token] of tokens) {
    const old = previous.get(name);
    if (!affected.has(name) && old?.resolvedValue !== undefined && sameTokenDefinition(old, token)) {
      token.resolvedValue = old.resolvedValue;
      token.value = old.resolvedValue;
      memo.set(name, old.resolvedValue);
      state.set(name, 2);
      reused++;
    }
  }

  const stack: string[] = [];
  const reportedCycles = new Set<string>();
  const resolve = (name: string): TokenValue | undefined => {
    const token = tokens.get(name);
    if (!token) return undefined;
    const s = state.get(name) ?? 0;
    if (s === 2) return memo.get(name);
    if (s === 1) {
      const start = stack.indexOf(name);
      const cycle = [...stack.slice(start), name];
      const key = canonicalCycle(cycle);
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        diagnostics.error("TOKEN_CYCLE", "Circular token reference detected.", { token: name, source: token.source, details: [cycle.join(" -> ")] });
      }
      return undefined;
    }
    state.set(name, 1);
    stack.push(name);
    if (isFullReference(token.rawValue)) {
      const targetName = fullReferenceTarget(token.rawValue);
      const target = targetName ? tokens.get(targetName) : undefined;
      if (target && target.type !== token.type) diagnostics.error("TOKEN_TYPE_MISMATCH", `Alias type mismatch. Expected ${token.type}; received ${target.type}.`, { token: name, source: token.source, details: [`${name} -> ${targetName}`] });
    }
    const value = deepResolve(token.rawValue, (ref) => resolve(ref));
    stack.pop();
    state.set(name, 2);
    if (value !== undefined) { memo.set(name, value); token.resolvedValue = value; token.value = value; }
    return value;
  };
  for (const name of [...affected].sort()) resolve(name);
  // New files can contain isolated new nodes not reachable from changedInput if the caller
  // provided an incomplete changed set; resolve any remaining node defensively.
  for (const name of [...tokens.keys()].sort()) if ((state.get(name) ?? 0) !== 2) resolve(name);
  return { tokens, diagnostics, dependencies, dependents, changed, affected, reused };
}

function detectChangedTokens(previous: Map<string, TokenNode>, next: Map<string, TokenNode>): Set<string> {
  const changed = new Set<string>();
  for (const name of new Set([...previous.keys(), ...next.keys()])) {
    const a = previous.get(name), b = next.get(name);
    if (!a || !b || !sameTokenDefinition(a, b)) changed.add(name);
  }
  return changed;
}
function sameTokenDefinition(a: TokenNode, b: TokenNode): boolean {
  return a.type === b.type && JSON.stringify(a.rawValue) === JSON.stringify(b.rawValue) && JSON.stringify(a.references) === JSON.stringify(b.references);
}
