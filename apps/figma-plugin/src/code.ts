figma.showUI(__html__, { width: 560, height: 680, themeColors: true });
type MetaVariable = {
  name: string;
  token: string;
  type: string;
  base: unknown;
  modes: Record<string, unknown>;
};
type Metadata = {
  collections: Array<{
    name: string;
    modes: string[];
    variables: MetaVariable[];
  }>;
};
type Drift = {
  token: string;
  name: string;
  mode: string;
  repository: unknown;
  figma: unknown;
  status: "missing" | "mismatch" | "match";
};
let current: Metadata | undefined;
figma.ui.onmessage = async (msg: {
  type: string;
  payload?: unknown;
  selected?: string[];
}) => {
  try {
    if (msg.type === "EXPORT") {
      const snapshot = await exportSnapshot();
      figma.ui.postMessage({ type: "EXPORT_RESULT", snapshot });
    } else if (msg.type === "SCAN") {
      const candidate = validateMetadata(msg.payload);
      current = undefined;
      const drift = await scan(candidate);
      current = candidate;
      figma.ui.postMessage({ type: "SCAN_RESULT", drift });
    } else if (msg.type === "APPLY") {
      if (!current) throw new Error("Scan metadata before applying.");
      const selected = new Set(msg.selected ?? []);
      const count = await apply(current, selected);
      figma.ui.postMessage({ type: "APPLY_RESULT", count });
      figma.notify(`Applied ${count} variable value changes.`);
    } else if (msg.type === "CLOSE") figma.closePlugin();
  } catch (error) {
    figma.ui.postMessage({
      type: "ERROR",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
function validateMetadata(value: unknown): Metadata {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as Metadata).collections)
  )
    throw new Error("Metadata must contain collections.");
  const metadata = value as Metadata;
  const identities = new Set<string>();
  const tokens = new Set<string>();
  for (const collection of metadata.collections) {
    if (
      typeof collection.name !== "string" ||
      !collection.name.trim() ||
      identities.has(collection.name) ||
      !Array.isArray(collection.variables) ||
      !Array.isArray(collection.modes)
    )
      throw new Error("Invalid or duplicate collection metadata.");
    identities.add(collection.name);
    for (const variable of collection.variables) {
      if (
        typeof variable.name !== "string" ||
        typeof variable.token !== "string" ||
        tokens.has(variable.token) ||
        !variable.modes ||
        typeof variable.modes !== "object" ||
        Array.isArray(variable.modes)
      )
        throw new Error("Invalid or duplicate variable metadata.");
      tokens.add(variable.token);
      if (
        ![
          "color",
          "dimension",
          "number",
          "fontFamily",
          "fontWeight",
          "fontSize",
          "lineHeight",
          "letterSpacing",
          "duration",
          "cubicBezier",
          "shadow",
          "border",
          "gradient",
          "opacity",
        ].includes(variable.type)
      )
        throw new Error(`Unknown variable token type ${variable.type}.`);
    }
  }
  return metadata;
}
function unique<T>(items: T[], label: string): T | undefined {
  if (items.length > 1)
    throw new Error(
      `Ambiguous ${label}; rename duplicates before synchronizing.`,
    );
  return items[0];
}
function findMode(collection: VariableCollection, name: string) {
  const mode = unique(
    collection.modes.filter((m) => m.name.toLowerCase() === name.toLowerCase()),
    `mode ${name}`,
  );
  return (
    mode ??
    (name === "base"
      ? collection.modes.find((m) => m.modeId === collection.defaultModeId)
      : undefined)
  );
}
async function scan(metadata: Metadata): Promise<Drift[]> {
  const [variables, collections] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.variables.getLocalVariableCollectionsAsync(),
  ]);
  const drift: Drift[] = [];
  for (const expectedCollection of metadata.collections) {
    const collection = unique(
      collections.filter((c) => c.name === expectedCollection.name),
      `collection ${expectedCollection.name}`,
    );
    for (const expected of expectedCollection.variables) {
      const variable = collection
        ? unique(
            variables.filter(
              (v) =>
                v.variableCollectionId === collection.id &&
                v.name === expected.name,
            ),
            `variable ${expected.name}`,
          )
        : undefined;
      for (const [modeName, repo] of Object.entries({
        base: expected.base,
        ...expected.modes,
      })) {
        const mode = collection ? findMode(collection, modeName) : undefined;
        const actual =
          variable && mode
            ? serializeFigmaValue(variable.valuesByMode[mode.modeId])
            : undefined;
        drift.push({
          token: expected.token,
          name: expected.name,
          mode: modeName,
          repository: repo,
          figma: actual,
          status:
            !variable || !mode
              ? "missing"
              : equalValue(repo, actual)
                ? "match"
                : "mismatch",
        });
      }
    }
  }
  return drift;
}
async function apply(
  metadata: Metadata,
  selected: Set<string>,
): Promise<number> {
  const [variables, collections] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.variables.getLocalVariableCollectionsAsync(),
  ]);
  const plan: Array<{
    collectionName: string;
    variable: MetaVariable;
    mode: string;
    value: VariableValue;
  }> = [];
  for (const collection of metadata.collections) {
    const actualCollection = unique(
      collections.filter((c) => c.name === collection.name),
      `collection ${collection.name}`,
    );
    for (const variable of collection.variables) {
      const actual = actualCollection
        ? unique(
            variables.filter(
              (v) =>
                v.variableCollectionId === actualCollection.id &&
                v.name === variable.name,
            ),
            `variable ${variable.name}`,
          )
        : undefined;
      for (const [mode, value] of Object.entries({
        base: variable.base,
        ...variable.modes,
      }))
        if (selected.has(`${variable.token}::${mode}`)) {
          if (actual && actual.resolvedType !== mapType(variable.type))
            throw new Error(`Variable type mismatch for ${variable.name}.`);
          if (actualCollection) findMode(actualCollection, mode);
          plan.push({
            collectionName: collection.name,
            variable,
            mode,
            value: toFigmaValue(variable.type, value),
          });
        }
    }
  }
  if (plan.length !== selected.size)
    throw new Error(
      "Selection contains unknown or duplicate token/mode keys. Scan again.",
    );
  // Preflight conversions and identities before any mutation; create only selected variables/modes.
  for (const item of plan) {
    let collection = unique(
      collections.filter((c) => c.name === item.collectionName),
      `collection ${item.collectionName}`,
    );
    if (!collection) {
      collection = figma.variables.createVariableCollection(
        item.collectionName,
      );
      collection.renameMode(collection.defaultModeId, "base");
      collections.push(collection);
    }
    let variable = unique(
      variables.filter(
        (v) =>
          v.variableCollectionId === collection!.id &&
          v.name === item.variable.name,
      ),
      `variable ${item.variable.name}`,
    );
    if (!variable) {
      variable = figma.variables.createVariable(
        item.variable.name,
        collection,
        mapType(item.variable.type),
      );
      variables.push(variable);
    }
    let mode = findMode(collection, item.mode);
    if (!mode) {
      const id = collection.addMode(item.mode);
      mode = { modeId: id, name: item.mode };
    }
    variable.setValueForMode(mode.modeId, item.value);
  }
  return plan.length;
}
function mapType(type: string): VariableResolvedDataType {
  return type === "color"
    ? "COLOR"
    : ["number", "fontWeight", "lineHeight", "opacity"].includes(type)
      ? "FLOAT"
      : "STRING";
}
function toFigmaValue(type: string, value: unknown): VariableValue {
  const expected = mapType(type);
  if (expected === "COLOR") {
    if (typeof value !== "string")
      throw new Error("Color variables require a hex string.");
    return hexToRgba(value);
  }
  if (expected === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error("Numeric variables require a finite number.");
    return value;
  }
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (serialized === undefined) throw new Error("Variable value is missing.");
  return serialized;
}
function hexToRgba(hex: string): RGBA {
  if (/^#[0-9a-f]{3,4}$/i.test(hex))
    hex = "#" + [...hex.slice(1)].map((c) => c + c).join("");
  const m = hex.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!m?.[1]) throw new Error(`Unsupported color for Figma sync: ${hex}`);
  const body = m[1];
  return {
    r: parseInt(body.slice(0, 2), 16) / 255,
    g: parseInt(body.slice(2, 4), 16) / 255,
    b: parseInt(body.slice(4, 6), 16) / 255,
    a: m[2] ? parseInt(m[2], 16) / 255 : 1,
  };
}
function serializeFigmaValue(value: VariableValue | undefined): unknown {
  if (
    value &&
    typeof value === "object" &&
    "r" in value &&
    "g" in value &&
    "b" in value
  )
    return rgbaToHex(value as RGBA);
  return value;
}
function rgbaToHex(v: RGBA): string {
  const c = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${c(v.r)}${c(v.g)}${c(v.b)}${v.a < 1 ? c(v.a) : ""}`;
}
function equalValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function exportSnapshot() {
  const [variables, collections] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.variables.getLocalVariableCollectionsAsync(),
  ]);
  await figma.loadAllPagesAsync();
  const components = figma.root.findAllWithCriteria({
    types: ["COMPONENT", "COMPONENT_SET"],
  });
  return {
    schemaVersion: 1,
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      defaultModeId: c.defaultModeId,
      modes: c.modes.map((m) => ({ id: m.modeId, name: m.name })),
    })),
    variables: variables.map((v) => ({
      id: v.id,
      name: v.name,
      collectionId: v.variableCollectionId,
      resolvedType: v.resolvedType,
      valuesByMode: v.valuesByMode,
      description: v.description,
      scopes: v.scopes,
    })),
    components: components.map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      type: c.type,
      description: c.description,
      properties: c.componentPropertyDefinitions,
    })),
  };
}
