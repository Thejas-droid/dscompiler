import type { DiffEntry, TokenMetadata } from "./types.js";

export function diffMetadata(before: TokenMetadata[], after: TokenMetadata[]): DiffEntry[] {
  const a = new Map(before.map((x) => [x.name, x]));
  const b = new Map(after.map((x) => [x.name, x]));
  const changes: DiffEntry[] = [];
  for (const name of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const oldValue = a.get(name);
    const newValue = b.get(name);
    if (!oldValue && newValue) changes.push({ kind: "added", name, after: newValue });
    else if (oldValue && !newValue) changes.push({ kind: "removed", name, before: oldValue });
    else if (oldValue && newValue) {
      const wasDeprecated = Boolean(oldValue.deprecated);
      const isDeprecated = Boolean(newValue.deprecated);
      if (!wasDeprecated && isDeprecated) changes.push({ kind: "deprecated", name, before: oldValue, after: newValue });
      else if (JSON.stringify(normalizeComparable(oldValue)) !== JSON.stringify(normalizeComparable(newValue))) changes.push({ kind: "changed", name, before: oldValue, after: newValue });
    }
  }
  return changes;
}

export function suggestSemver(changes: DiffEntry[]): "patch" | "minor" | "major" {
  if (changes.some((x) => x.kind === "removed")) return "major";
  if (changes.some((x) => x.kind === "added" || x.kind === "deprecated")) return "minor";
  if (changes.some((x) => x.kind === "changed" && structuralChange(x.before, x.after))) return "major";
  return "patch";
}

function structuralChange(a: unknown, b: unknown): boolean {
  const before = a as Partial<TokenMetadata> | undefined;
  const after = b as Partial<TokenMetadata> | undefined;
  return Boolean(before && after && (before.type !== after.type));
}
function normalizeComparable(value: TokenMetadata): unknown {
  const { source, ...rest } = value;
  return rest;
}
