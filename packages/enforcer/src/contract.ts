import { TOKEN_TYPES } from "@dsc/compiler";
import { RULES, type Contract, type EnforcementConfig } from "./types.js";

export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new Error(`Unknown ${label} field: ${key}.`);
}
function strings(
  value: unknown,
  label: string,
  nonempty = false,
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    (nonempty && !value.length) ||
    value.some((x) => typeof x !== "string" || !x.trim())
  )
    throw new Error(
      `${label} must be ${nonempty ? "a nonempty" : "an"} array of nonempty strings.`,
    );
}
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} must be a nonempty string.`);
}
export function glob(pattern: string): RegExp {
  // Deliberately limited portable glob dialect; reject unsupported syntax rather than silently miss files.
  if (
    !pattern ||
    pattern.startsWith("/") ||
    /[\\\[\]{}!]/.test(pattern) ||
    pattern.split("/").includes("..")
  )
    throw new Error(
      `Invalid relative glob '${pattern}'. Use /, *, **, or ?; do not use braces, brackets, absolute paths or parent traversal.`,
    );
  let output = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*" && pattern[i + 1] === "*") {
      i++;
      if (pattern[i + 1] === "/") {
        i++;
        output += "(?:.*/)?";
      } else output += ".*";
    } else if (c === "*") output += "[^/]*";
    else if (c === "?") output += "[^/]";
    else output += c.replace(/[.+^$()|]/g, "\\$&");
  }
  return new RegExp(output + "$");
}
export function matches(file: string, patterns: string[]): boolean {
  return patterns.some((p) => glob(p).test(file));
}
export function validateEnforcement(value: unknown): EnforcementConfig {
  const v = object(value, "enforcement");
  keys(v, ["contract", "include", "exclude", "mode"], "enforcement");
  text(v.contract, "enforcement.contract");
  strings(v.include, "enforcement.include", true);
  if (v.exclude !== undefined) strings(v.exclude, "enforcement.exclude");
  for (const p of [...v.include, ...((v.exclude as string[]) ?? [])]) glob(p);
  if (v.mode !== undefined && v.mode !== "warn" && v.mode !== "strict")
    throw new Error("enforcement.mode must be warn or strict.");
  return v as unknown as EnforcementConfig;
}
export function validateContract(value: unknown): Contract {
  const v = object(value, "contract");
  keys(
    v,
    [
      "version",
      "name",
      "properties",
      "implementation",
      "components",
      "forbiddenImports",
      "rules",
      "exceptions",
    ],
    "contract",
  );
  if (v.version !== 1) throw new Error("contract.version must be 1.");
  text(v.name, "contract.name");
  const properties = object(v.properties, "contract.properties");
  if (!Object.keys(properties).length)
    throw new Error(
      "contract.properties must govern at least one CSS property.",
    );
  for (const [name, raw] of Object.entries(properties)) {
    if (!/^--[\w-]+$|^[a-z][a-z-]*$/.test(name))
      throw new Error(`Property '${name}' must use CSS kebab-case.`);
    const p = object(raw, `properties.${name}`);
    keys(p, ["types", "tokens", "allow"], `properties.${name}`);
    strings(p.types, `properties.${name}.types`, true);
    if (p.types.some((t) => !(TOKEN_TYPES as readonly string[]).includes(t)))
      throw new Error(`Invalid token type for ${name}.`);
    if (p.tokens !== undefined) {
      strings(p.tokens, `properties.${name}.tokens`, true);
      p.tokens.forEach(glob);
    }
    if (
      p.allow !== undefined &&
      (!Array.isArray(p.allow) ||
        p.allow.some((x) => typeof x !== "string" && typeof x !== "number"))
    )
      throw new Error(`Invalid allowed values for ${name}.`);
  }
  if (v.implementation !== undefined) {
    strings(v.implementation, "implementation");
    v.implementation.forEach(glob);
  }
  if (v.rules !== undefined)
    for (const [name, severity] of Object.entries(object(v.rules, "rules"))) {
      if (
        !(RULES as readonly string[]).includes(name) ||
        !["error", "warning", "off"].includes(String(severity))
      )
        throw new Error(`Invalid rule setting: ${name}.`);
    }
  if (v.forbiddenImports !== undefined) {
    strings(v.forbiddenImports, "forbiddenImports");
    v.forbiddenImports.forEach(glob);
  }
  if (v.components !== undefined) {
    if (!Array.isArray(v.components))
      throw new Error("components must be an array.");
    const identities = new Set<string>();
    for (const raw of v.components) {
      const c = object(raw, "component");
      keys(
        c,
        ["from", "name", "replaces", "variants", "forbidProps"],
        "component",
      );
      text(c.from, "component.from");
      text(c.name, "component.name");
      const id = `${c.from}:${c.name}`;
      if (identities.has(id))
        throw new Error(`Duplicate component mapping: ${id}.`);
      identities.add(id);
      if (c.replaces !== undefined) strings(c.replaces, "component.replaces");
      if (c.forbidProps !== undefined)
        strings(c.forbidProps, "component.forbidProps");
      if (c.variants !== undefined)
        for (const values of Object.values(
          object(c.variants, "component.variants"),
        ))
          strings(values, "component variant values", true);
    }
  }
  if (v.exceptions !== undefined) {
    if (!Array.isArray(v.exceptions))
      throw new Error("exceptions must be an array.");
    for (const raw of v.exceptions) {
      const e = object(raw, "exception");
      keys(e, ["files", "rules", "reason", "expires"], "exception");
      strings(e.files, "exception.files", true);
      e.files.forEach(glob);
      strings(e.rules, "exception.rules", true);
      if (e.rules.some((r) => !(RULES as readonly string[]).includes(r)))
        throw new Error("Exceptions may suppress source rules only.");
      text(e.reason, "exception.reason");
      text(e.expires, "exception.expires");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(e.expires) ||
        Number.isNaN(Date.parse(e.expires)) ||
        new Date(e.expires).toISOString().slice(0, 10) !== e.expires
      )
        throw new Error("exception.expires must be a valid YYYY-MM-DD date.");
    }
  }
  return v as unknown as Contract;
}

export function mayContain(directory: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const prefix = pattern.split(/[?*]/)[0]!;
    return (
      prefix.startsWith(directory + "/") ||
      (directory + "/").startsWith(prefix) ||
      glob(pattern).test(directory + "/")
    );
  });
}
