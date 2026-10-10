import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function stableStringify(value: unknown, space = 2): string {
  const seen = new WeakSet<object>();
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === "object") {
      if (seen.has(input as object)) throw new TypeError("Cannot stringify circular object");
      seen.add(input as object);
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(input as Record<string, unknown>).sort()) out[key] = sort((input as Record<string, unknown>)[key]);
      return out;
    }
    return input;
  };
  return JSON.stringify(sort(value), null, space);
}

export function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function cssVariable(pathName: string, prefix = "ds", separator = "-"): string {
  const normalized = pathName
    .replace(/([a-z0-9])([A-Z])/g, `$1${separator}$2`)
    .replace(/[._\s/]+/g, separator)
    .replace(new RegExp(`${escapeRegExp(separator)}+`, "g"), separator)
    .toLowerCase();
  return `--${prefix}${separator}${normalized}`;
}

export function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function toKebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[._\s/]+/g, "-").toLowerCase();
}

export function formatCssValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(formatCssValue).join(", ");
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("value" in v && "unit" in v) return `${String(v.value)}${String(v.unit)}`;
    if ("x" in v && "y" in v && "blur" in v && "color" in v) {
      return `${formatCssValue(v.x)} ${formatCssValue(v.y)} ${formatCssValue(v.blur)} ${formatCssValue(v.spread ?? 0)} ${formatCssValue(v.color)}`;
    }
  }
  return JSON.stringify(value);
}

export async function writeIfChanged(file: string, content: string): Promise<boolean> {
  try { if (await readFile(file, "utf8") === content) return false; } catch { /* missing */ }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return true;
}

export function safeJoin(root: string, relative: string): string {
  if (path.isAbsolute(relative)) throw new Error(`Absolute registry path is not allowed: ${relative}`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Path traversal rejected: ${relative}`);
  return resolved;
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min((current[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev.splice(0, prev.length, ...current);
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

export function nearest(input: string, candidates: Iterable<string>): string | undefined {
  let best: { value: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = levenshtein(input, candidate);
    if (!best || distance < best.distance) best = { value: candidate, distance };
  }
  if (!best) return undefined;
  return best.distance <= Math.max(2, Math.floor(input.length * 0.35)) ? best.value : undefined;
}
