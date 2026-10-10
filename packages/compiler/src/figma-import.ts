import { TOKEN_TYPES, type TokenType } from "./types.js";

type RecordValue = Record<string, unknown>;
function obj(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as RecordValue;
}
function str(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} must be a string.`);
  return value;
}
function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}
const safeSegment = (segment: string) =>
  /^[a-zA-Z0-9_-]+$/.test(segment) &&
  !["__proto__", "prototype", "constructor"].includes(segment);
function assign(root: RecordValue, tokenPath: string, value: unknown) {
  const parts = tokenPath.split(".");
  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    if (!(part in cursor)) cursor[part] = Object.create(null);
    cursor = obj(cursor[part], `Token group ${part}`);
    if ("$value" in cursor)
      throw new Error(`Token/group collision at ${tokenPath}.`);
  }
  const last = parts.at(-1)!;
  if (last in cursor) throw new Error(`Duplicate token/group at ${tokenPath}.`);
  cursor[last] = value;
}
export interface FigmaImportResult {
  tokens: RecordValue;
  themes: Record<string, RecordValue>;
  ignored: string[];
  components: unknown[];
}
/** Offline conversion of a versioned Plugin API snapshot. Does not parse .fig bytes or infer component behavior. */
export function importFigmaSnapshot(
  input: unknown,
  mappingInput: unknown,
): FigmaImportResult {
  const snapshot = obj(input, "snapshot");
  const mapping = obj(mappingInput, "mapping");
  if (snapshot.schemaVersion !== 1)
    throw new Error("Unsupported Figma snapshot schemaVersion; expected 1.");
  const mappings = obj(mapping.variables, "mapping.variables");
  const ignored =
    mapping.ignoreVariables === undefined
      ? []
      : list(mapping.ignoreVariables, "ignoreVariables").map((v) =>
          str(v, "ignored variable"),
        );
  const ignoredSet = new Set(ignored);
  const collections = new Map<
    string,
    { defaultMode: string; modes: Array<{ id: string; name: string }> }
  >();
  const modeMapping =
    mapping.modes === undefined ? {} : obj(mapping.modes, "mapping.modes");
  for (const entry of list(snapshot.collections, "collections")) {
    const c = obj(entry, "collection");
    const id = str(c.id, "collection.id");
    if (collections.has(id)) throw new Error(`Duplicate collection ${id}.`);
    const modes = list(c.modes, "collection.modes").map((raw) => {
      const m = obj(raw, "mode");
      return { id: str(m.id, "mode.id"), name: str(m.name, "mode.name") };
    });
    if (!modes.length || new Set(modes.map((m) => m.id)).size !== modes.length)
      throw new Error(`Invalid modes for ${id}.`);
    const defaultMode = str(c.defaultModeId, "defaultModeId");
    if (!modes.some((m) => m.id === defaultMode))
      throw new Error(`Default mode missing in ${id}.`);
    collections.set(id, { defaultMode, modes });
  }
  const variables = new Map<string, RecordValue>();
  for (const entry of list(snapshot.variables, "variables")) {
    const v = obj(entry, "variable");
    const id = str(v.id, "variable.id");
    if (variables.has(id)) throw new Error(`Duplicate variable ${id}.`);
    if (!collections.has(str(v.collectionId, "collectionId")))
      throw new Error(`Unknown collection for ${id}.`);
    variables.set(id, v);
    if (!Object.hasOwn(mappings, id) && !ignoredSet.has(id))
      throw new Error(
        `Variable ${id} has no explicit mapping or ignore decision.`,
      );
  }
  const paths = new Set<string>();
  const definitions = new Map<
    string,
    { path: string; type: TokenType; unit?: string }
  >();
  for (const [id, raw] of Object.entries(mappings)) {
    if (!variables.has(id) || ignoredSet.has(id))
      throw new Error(`Mapped variable ${id} is missing or also ignored.`);
    const m = obj(raw, `mapping ${id}`);
    const tokenPath = str(m.path, "mapping.path");
    const type = str(m.type, "mapping.type") as TokenType;
    if (!tokenPath.split(".").every(safeSegment) || paths.has(tokenPath))
      throw new Error(`Invalid or duplicate token path ${tokenPath}.`);
    if (!(TOKEN_TYPES as readonly string[]).includes(type))
      throw new Error(`Unsupported token type ${type}.`);
    const unit = m.unit === undefined ? undefined : str(m.unit, "mapping.unit");
    if (unit && !["px", "rem", "em", "%", "ms", "s"].includes(unit))
      throw new Error(`Unsupported unit ${unit}.`);
    paths.add(tokenPath);
    definitions.set(id, { path: tokenPath, type, ...(unit ? { unit } : {}) });
  }
  for (const id of ignored)
    if (!variables.has(id))
      throw new Error(`Ignored variable ${id} does not exist.`);
  const tokens: RecordValue = Object.create(null);
  const themes: Record<string, RecordValue> = Object.create(null);
  function convert(raw: unknown, id: string): unknown {
    const definition = definitions.get(id)!;
    if (
      raw &&
      typeof raw === "object" &&
      obj(raw, "value").type === "VARIABLE_ALIAS"
    ) {
      const target = definitions.get(str(obj(raw, "alias").id, "alias.id"));
      if (!target)
        throw new Error(`Alias from ${id} points to an unmapped variable.`);
      if (target.type !== definition.type)
        throw new Error(`Alias type mismatch at ${id}.`);
      return `{${target.path}}`;
    }
    const resolvedType = variables.get(id)!.resolvedType;
    if (resolvedType === "COLOR") {
      if (definition.type !== "color")
        throw new Error(`${id} must map to a color token.`);
      const rgba = obj(raw, "color");
      const channel = (name: string, fallback?: number) => {
        const value = rgba[name] ?? fallback;
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1
        )
          throw new Error(`Invalid ${name} channel for ${id}.`);
        return Math.round(value * 255)
          .toString(16)
          .padStart(2, "0")
          .toUpperCase();
      };
      const alpha = channel("a", 1);
      return `#${channel("r")}${channel("g")}${channel("b")}${alpha === "FF" ? "" : alpha}`;
    }
    if (resolvedType === "FLOAT") {
      if (typeof raw !== "number" || !Number.isFinite(raw))
        throw new Error(`Invalid numeric value for ${id}.`);
      if (
        ["dimension", "fontSize", "letterSpacing"].includes(definition.type)
      ) {
        if (
          !definition.unit ||
          !["px", "rem", "em", "%"].includes(definition.unit)
        )
          throw new Error(`Explicit dimension unit required for ${id}.`);
        return `${raw}${definition.unit}`;
      }
      if (definition.type === "duration") {
        if (!definition.unit || !["ms", "s"].includes(definition.unit))
          throw new Error(`Explicit duration unit required for ${id}.`);
        return `${raw}${definition.unit}`;
      }
      if (
        !["number", "fontWeight", "lineHeight", "opacity"].includes(
          definition.type,
        )
      )
        throw new Error(`Unsupported FLOAT mapping for ${id}.`);
      return raw;
    }
    if (
      resolvedType === "STRING" &&
      typeof raw === "string" &&
      definition.type === "fontFamily"
    )
      return raw;
    throw new Error(
      `Unsupported ${String(resolvedType)} mapping for ${id}; make an explicit ignore decision.`,
    );
  }
  for (const [id, definition] of definitions) {
    const variable = variables.get(id)!;
    const collectionId = str(variable.collectionId, "collectionId");
    const collection = collections.get(collectionId)!;
    const values = obj(variable.valuesByMode, "valuesByMode");
    if (!(collection.defaultMode in values))
      throw new Error(`Default value missing for ${id}.`);
    assign(tokens, definition.path, {
      $type: definition.type,
      $value: convert(values[collection.defaultMode], id),
      ...(typeof variable.description === "string" && variable.description
        ? { $description: variable.description }
        : {}),
      $extensions: {
        "dsc.figma": {
          id,
          name: variable.name,
          collectionId,
          scopes: variable.scopes ?? [],
        },
      },
    });
    const names = new Set<string>();
    for (const mode of collection.modes) {
      const namesForCollection =
        modeMapping[collectionId] === undefined
          ? {}
          : obj(modeMapping[collectionId], "collection mode mapping");
      const name = String(
        namesForCollection[mode.id] ??
          mode.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
      );
      if (!safeSegment(name) || names.has(name))
        throw new Error(
          `Invalid or duplicate theme name ${name}; supply explicit mode mapping.`,
        );
      names.add(name);
      if (!(mode.id in values))
        throw new Error(`Mode ${mode.id} has no value for ${id}.`);
      if (mode.id === collection.defaultMode) continue;
      if (!themes[name]) themes[name] = { $name: name };
      assign(themes[name]!, definition.path, {
        $type: definition.type,
        $value: convert(values[mode.id], id),
      });
    }
  }
  if (!definitions.size)
    throw new Error("At least one mapped variable is required.");
  return {
    tokens,
    themes,
    ignored,
    components: list(snapshot.components ?? [], "components"),
  };
}
