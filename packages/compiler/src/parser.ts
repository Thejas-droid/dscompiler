import { readFile } from "node:fs/promises";
import path from "node:path";
import { DiagnosticBag, sourceAt } from "./diagnostics.js";
import { TOKEN_TYPES, type TokenNode, type TokenType, type TokenValue } from "./types.js";

const REF_RE = /\{([a-zA-Z0-9_.\-/]+)\}/g;
const FULL_REF_RE = /^\{([a-zA-Z0-9_.\-/]+)\}$/;

export interface ParseResult {
  tokens: Map<string, TokenNode>;
  diagnostics: DiagnosticBag;
  data: unknown;
  text: string;
}

export async function parseTokenFile(file: string, sourceKind: TokenNode["sourceKind"] = "unknown"): Promise<ParseResult> {
  const text = await readFile(file, "utf8");
  const diagnostics = new DiagnosticBag();
  let data: unknown;
  try {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".yaml" || ext === ".yml") data = parseSimpleYaml(text);
    else data = JSON.parse(ext === ".jsonc" ? stripJsonComments(text) : text);
  } catch (error) {
    diagnostics.error("TOKEN_FILE_INVALID", error instanceof Error ? error.message : String(error), { source: { file, line: 1, column: 1 } });
    return { tokens: new Map(), diagnostics, data: {}, text };
  }
  const tokens = flattenTokenData(data, { file, text, diagnostics, sourceKind });
  return { tokens, diagnostics, data, text };
}

export function flattenTokenData(
  data: unknown,
  options: { file: string; text?: string; diagnostics?: DiagnosticBag; sourceKind?: TokenNode["sourceKind"] }
): Map<string, TokenNode> {
  const diagnostics = options.diagnostics ?? new DiagnosticBag();
  const out = new Map<string, TokenNode>();
  const text = options.text ?? JSON.stringify(data, null, 2);
  let locationCursor = 0;
  const locate = (segment: string) => {
    const quoted = `"${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`;
    let index = text.indexOf(quoted, locationCursor);
    if (index < 0) index = text.indexOf(`${segment}:`, locationCursor);
    if (index < 0) return sourceAt(options.file, text, quoted);
    locationCursor = index + Math.max(1, quoted.length);
    const before = text.slice(0, index);
    const lines = before.split(/\r?\n/);
    return { file: options.file, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
  };

  const walk = (node: unknown, segments: string[], inheritedType?: TokenType): void => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const record = node as Record<string, unknown>;
    const groupType = isTokenType(record.$type) ? record.$type : inheritedType;

    if ("$value" in record) {
      const tokenPath = segments.join(".");
      if (!tokenPath) {
        diagnostics.error("TOKEN_SCHEMA_INVALID", "Token cannot exist at the document root.", { source: { file: options.file, line: 1, column: 1 } });
        return;
      }
      const type = isTokenType(record.$type) ? record.$type : groupType;
      if (!type) {
        diagnostics.error("TOKEN_SCHEMA_INVALID", `Token \"${tokenPath}\" is missing a valid $type.`, {
          token: tokenPath,
          source: locate(segments.at(-1) ?? tokenPath)
        });
        return;
      }
      const value = record.$value as TokenValue;
      if (!validateValue(type, value)) {
        diagnostics.error("TOKEN_SCHEMA_INVALID", `Token \"${tokenPath}\" has an invalid value for type ${type}.`, {
          token: tokenPath,
          source: locate(segments.at(-1) ?? tokenPath)
        });
      }
      const refs = extractReferences(value);
      const source = locate(segments.at(-1) ?? tokenPath);
      const tags = Array.isArray(record.$tags) ? record.$tags.filter((x): x is string => typeof x === "string") : undefined;
      const deprecated = parseDeprecated(record.$deprecated);
      out.set(tokenPath, {
        path: tokenPath,
        type,
        value,
        rawValue: value,
        source,
        references: refs,
        sourceKind: options.sourceKind ?? "unknown",
        ...(typeof record.$description === "string" ? { description: record.$description } : {}),
        ...(typeof record.$since === "string" ? { since: record.$since } : {}),
        ...(tags?.length ? { tags } : {}),
        ...(deprecated !== undefined ? { deprecated } : {})
      });
      return;
    }

    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith("$")) continue;
      walk(value, [...segments, key], groupType);
    }
  };

  walk(data, []);
  return out;
}

export function extractReferences(value: unknown): string[] {
  const refs = new Set<string>();
  const scan = (input: unknown): void => {
    if (typeof input === "string") {
      for (const match of input.matchAll(REF_RE)) if (match[1]) refs.add(match[1]);
    } else if (Array.isArray(input)) input.forEach(scan);
    else if (input && typeof input === "object") Object.values(input as Record<string, unknown>).forEach(scan);
  };
  scan(value);
  return [...refs].sort();
}

export function isFullReference(value: unknown): value is string {
  return typeof value === "string" && FULL_REF_RE.test(value);
}

export function fullReferenceTarget(value: string): string | undefined {
  return value.match(FULL_REF_RE)?.[1];
}

function isTokenType(value: unknown): value is TokenType {
  return typeof value === "string" && (TOKEN_TYPES as readonly string[]).includes(value);
}

function parseDeprecated(value: unknown): TokenNode["deprecated"] | undefined {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return {
      ...(typeof v.message === "string" ? { message: v.message } : {}),
      ...(typeof v.replacement === "string" ? { replacement: v.replacement } : {}),
      ...(typeof v.since === "string" ? { since: v.since } : {})
    };
  }
  return undefined;
}

function validateValue(type: TokenType, value: TokenValue): boolean {
  if (isFullReference(value)) return true;
  switch (type) {
    case "color": return typeof value === "string" && (/^#(?:[\da-f]{3,8})$/i.test(value) || /^(?:rgb|hsl|oklch|color)\(/i.test(value));
    case "dimension":
    case "fontSize":
    case "letterSpacing": return typeof value === "string" || isDimensionObject(value);
    case "number":
    case "fontWeight":
    case "lineHeight":
    case "opacity": return typeof value === "number" || typeof value === "string";
    case "duration": return typeof value === "string" || isDimensionObject(value);
    case "fontFamily": return typeof value === "string" || (Array.isArray(value) && value.every((x) => typeof x === "string"));
    case "cubicBezier": return (Array.isArray(value) && value.length === 4 && value.every((x) => typeof x === "number")) || typeof value === "string";
    case "shadow": return typeof value === "string" || isPlainObject(value) || (Array.isArray(value) && value.every(isPlainObject));
    case "border":
    case "gradient": return typeof value === "string" || isPlainObject(value) || Array.isArray(value);
  }
}

function isDimensionObject(value: unknown): boolean {
  return isPlainObject(value) && typeof (value as Record<string, unknown>).value === "number" && typeof (value as Record<string, unknown>).unit === "string";
}
function isPlainObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }

export function stripJsonComments(text: string): string {
  let out = "";
  let inString = false;
  let quote = '"';
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? "";
    const n = text[i + 1] ?? "";
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) inString = false;
      continue;
    }
    if (c === '"' || c === "'") { inString = true; quote = c; out += c; continue; }
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length - 1 && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] === "\n") out += "\n";
        i++;
      }
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

// A deliberately small YAML subset for design-token files: nested mappings,
// inline arrays/objects, booleans, null, numbers and quoted/unquoted scalars.
export function parseSimpleYaml(text: string): unknown {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [{ indent: -1, value: root }];
  const lines = text.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const original = lines[lineNo] ?? "";
    if (!original.trim() || original.trimStart().startsWith("#")) continue;
    const indent = original.length - original.trimStart().length;
    const line = stripYamlComment(original.trim());
    const colon = findYamlColon(line);
    if (colon < 1) throw new Error(`Invalid YAML at line ${lineNo + 1}: expected key: value`);
    const key = unquote(line.slice(0, colon).trim());
    const tail = line.slice(colon + 1).trim();
    while (stack.length > 1 && indent <= (stack.at(-1)?.indent ?? -1)) stack.pop();
    const parent = stack.at(-1)?.value ?? root;
    if (!tail) {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    } else parent[key] = parseYamlScalar(tail);
  }
  return root;
}

function stripYamlComment(line: string): string {
  let quote: string | undefined;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? "";
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(line[i - 1] ?? ""))) return line.slice(0, i).trimEnd();
  }
  return line;
}

function findYamlColon(line: string): number {
  let quote: string | undefined;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? "";
    if (quote) { if (c === quote && line[i - 1] !== "\\") quote = undefined; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === ":" && depth === 0) return i;
  }
  return -1;
}

function parseYamlScalar(value: string): unknown {
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return unquote(value);
  if (value.startsWith("[") || value.startsWith("{")) {
    try { return JSON.parse(value.replace(/'/g, '"')); } catch { return value; }
  }
  return value;
}
function unquote(value: string): string { return value.replace(/^(["'])|(["'])$/g, ""); }
