import { describe, expect, test } from "vitest";
import { importFigmaSnapshot } from "../src/index.js";
const snapshot = {
  schemaVersion: 1,
  collections: [
    {
      id: "c1",
      name: "Colors",
      defaultModeId: "light",
      modes: [
        { id: "light", name: "Light" },
        { id: "dark", name: "Dark" },
      ],
    },
  ],
  variables: [
    {
      id: "brand",
      name: "Brand",
      collectionId: "c1",
      resolvedType: "COLOR",
      valuesByMode: {
        light: { r: 0, g: 0, b: 0, a: 1 },
        dark: { r: 1, g: 1, b: 1, a: 1 },
      },
    },
    {
      id: "action",
      name: "Action",
      collectionId: "c1",
      resolvedType: "COLOR",
      valuesByMode: {
        light: { type: "VARIABLE_ALIAS", id: "brand" },
        dark: { type: "VARIABLE_ALIAS", id: "brand" },
      },
    },
  ],
  components: [{ id: "button", name: "Button" }],
};
const mapping = {
  variables: {
    brand: { path: "color.brand", type: "color" },
    action: { path: "color.action", type: "color" },
  },
};
describe("structured Figma import", () => {
  test("preserves aliases, IDs, modes and component metadata deterministically", () => {
    const result = importFigmaSnapshot(snapshot, mapping);
    expect(result.tokens).toMatchObject({
      color: {
        brand: { $value: "#000000" },
        action: { $value: "{color.brand}" },
      },
    });
    expect(result.themes.dark).toMatchObject({
      $name: "dark",
      color: { brand: { $value: "#FFFFFF" } },
    });
    expect(result.components).toEqual(snapshot.components);
    expect(JSON.stringify(result)).toBe(
      JSON.stringify(importFigmaSnapshot(snapshot, mapping)),
    );
  });
  test("requires explicit mapping decisions", () => {
    expect(() =>
      importFigmaSnapshot(snapshot, {
        variables: { brand: mapping.variables.brand },
      }),
    ).toThrow(/no explicit mapping/);
  });
  test("rejects aliases to ignored or unmapped variables", () => {
    expect(() =>
      importFigmaSnapshot(snapshot, {
        variables: { action: mapping.variables.action },
        ignoreVariables: ["brand"],
      }),
    ).toThrow(/unmapped/);
  });
  test("rejects unsafe or duplicate paths", () => {
    for (const path of ["__proto__.polluted", "color.brand"])
      expect(() =>
        importFigmaSnapshot(snapshot, {
          variables: {
            brand: mapping.variables.brand,
            action: { path, type: "color" },
          },
        }),
      ).toThrow();
  });
  test("numeric dimensions require explicit units", () => {
    const s = {
      ...snapshot,
      variables: [
        {
          id: "space",
          name: "Space",
          collectionId: "c1",
          resolvedType: "FLOAT",
          valuesByMode: { light: 8, dark: 16 },
        },
      ],
    };
    expect(() =>
      importFigmaSnapshot(s, {
        variables: { space: { path: "space.md", type: "dimension" } },
      }),
    ).toThrow(/unit/);
    expect(
      importFigmaSnapshot(s, {
        variables: {
          space: { path: "space.md", type: "dimension", unit: "px" },
        },
      }).tokens,
    ).toMatchObject({ space: { md: { $value: "8px" } } });
  });
  test("rejects invalid color channels and missing mode values", () => {
    expect(() =>
      importFigmaSnapshot(
        {
          ...snapshot,
          variables: [
            {
              ...snapshot.variables[0],
              valuesByMode: {
                light: { r: 2, g: 0, b: 0, a: 1 },
                dark: { r: 0, g: 0, b: 0, a: 1 },
              },
            },
          ],
        },
        { variables: { brand: mapping.variables.brand } },
      ),
    ).toThrow(/channel/);
    expect(() =>
      importFigmaSnapshot(
        {
          ...snapshot,
          variables: [
            {
              ...snapshot.variables[0],
              valuesByMode: { light: { r: 0, g: 0, b: 0, a: 1 } },
            },
          ],
        },
        { variables: { brand: mapping.variables.brand } },
      ),
    ).toThrow(/no value/);
  });
  test("rejects token/group collisions", () => {
    expect(() =>
      importFigmaSnapshot(snapshot, {
        variables: {
          brand: { path: "color", type: "color" },
          action: { path: "color.action", type: "color" },
        },
      }),
    ).toThrow(/collision/);
  });
  test("unsupported boolean variables require explicit ignore", () => {
    const s = {
      ...snapshot,
      variables: [
        ...snapshot.variables,
        {
          id: "flag",
          name: "Flag",
          collectionId: "c1",
          resolvedType: "BOOLEAN",
          valuesByMode: { light: true, dark: false },
        },
      ],
    };
    expect(() => importFigmaSnapshot(s, mapping)).toThrow(/mapping/);
    expect(
      importFigmaSnapshot(s, { ...mapping, ignoreVariables: ["flag"] }).ignored,
    ).toEqual(["flag"]);
  });
});
