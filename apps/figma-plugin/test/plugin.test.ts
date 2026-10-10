import { afterEach, beforeEach, expect, test, vi } from "vitest";
let api: any;
beforeEach(async () => {
  vi.resetModules();
  api = {
    showUI: vi.fn(),
    ui: { onmessage: undefined, postMessage: vi.fn() },
    notify: vi.fn(),
    variables: {
      getLocalVariablesAsync: vi.fn(async () => []),
      getLocalVariableCollectionsAsync: vi.fn(async () => []),
      createVariableCollection: vi.fn(),
      createVariable: vi.fn(),
    },
    loadAllPagesAsync: vi.fn(),
    root: { findAllWithCriteria: vi.fn(() => []) },
  };
  vi.stubGlobal("figma", api);
  vi.stubGlobal("__html__", "<html/>");
  await import("../src/code.js");
});
afterEach(() => vi.unstubAllGlobals());
const metadata = {
  collections: [
    {
      name: "Colors",
      modes: ["base"],
      variables: [
        {
          name: "Brand",
          token: "color.brand",
          type: "color",
          base: "#0B6B58",
          modes: {},
        },
        {
          name: "Other",
          token: "color.other",
          type: "color",
          base: "#FFFFFF",
          modes: {},
        },
      ],
    },
  ],
};
test("exports modes, aliases, identity, scopes and component inventory without writes", async () => {
  api.variables.getLocalVariableCollectionsAsync.mockResolvedValue([
    {
      id: "c",
      name: "Colors",
      defaultModeId: "m",
      modes: [{ modeId: "m", name: "Light" }],
    },
  ]);
  api.variables.getLocalVariablesAsync.mockResolvedValue([
    {
      id: "v",
      name: "Brand",
      variableCollectionId: "c",
      resolvedType: "COLOR",
      valuesByMode: { m: { type: "VARIABLE_ALIAS", id: "other" } },
      description: "Brand",
      scopes: ["ALL_FILLS"],
    },
  ]);
  api.root.findAllWithCriteria.mockReturnValue([
    {
      id: "button",
      key: "key",
      name: "Button",
      type: "COMPONENT",
      description: "",
      componentPropertyDefinitions: {},
    },
  ]);
  await api.ui.onmessage({ type: "EXPORT" });
  expect(api.ui.postMessage.mock.calls[0][0]).toMatchObject({
    type: "EXPORT_RESULT",
    snapshot: {
      schemaVersion: 1,
      collections: [
        { defaultModeId: "m", modes: [{ id: "m", name: "Light" }] },
      ],
      variables: [
        {
          id: "v",
          collectionId: "c",
          valuesByMode: { m: { type: "VARIABLE_ALIAS", id: "other" } },
        },
      ],
      components: [{ id: "button" }],
    },
  });
  expect(api.variables.createVariable).not.toHaveBeenCalled();
});
test("empty apply selection creates no collections or variables", async () => {
  await api.ui.onmessage({ type: "SCAN", payload: metadata });
  await api.ui.onmessage({ type: "APPLY", selected: [] });
  expect(api.variables.createVariableCollection).not.toHaveBeenCalled();
  expect(api.variables.createVariable).not.toHaveBeenCalled();
});
test("apply creates only the selected variable", async () => {
  const collection = {
    id: "c",
    name: "Colors",
    defaultModeId: "m",
    modes: [{ modeId: "m", name: "base" }],
    renameMode: vi.fn(),
    addMode: vi.fn(),
  };
  const variable = {
    name: "Brand",
    variableCollectionId: "c",
    setValueForMode: vi.fn(),
  };
  api.variables.createVariableCollection.mockReturnValue(collection);
  api.variables.createVariable.mockReturnValue(variable);
  await api.ui.onmessage({ type: "SCAN", payload: metadata });
  await api.ui.onmessage({ type: "APPLY", selected: ["color.brand::base"] });
  expect(api.variables.createVariable).toHaveBeenCalledTimes(1);
  expect(api.variables.createVariable.mock.calls[0][0]).toBe("Brand");
  expect(variable.setValueForMode).toHaveBeenCalledTimes(1);
});
test("same-named variable in another collection is not treated as a match", async () => {
  api.variables.getLocalVariableCollectionsAsync.mockResolvedValue([
    {
      id: "other",
      name: "Other",
      defaultModeId: "m",
      modes: [{ modeId: "m", name: "base" }],
    },
  ]);
  api.variables.getLocalVariablesAsync.mockResolvedValue([
    {
      name: "Brand",
      variableCollectionId: "other",
      valuesByMode: { m: { r: 0.043, g: 0.42, b: 0.345, a: 1 } },
    },
  ]);
  await api.ui.onmessage({ type: "SCAN", payload: metadata });
  expect(api.ui.postMessage.mock.calls[0][0].drift[0].status).toBe("missing");
});
test("invalid selected values fail preflight without mutation", async () => {
  const invalid = structuredClone(metadata);
  invalid.collections[0]!.variables[0]!.base = "unsupported-color";
  await api.ui.onmessage({ type: "SCAN", payload: invalid });
  await api.ui.onmessage({ type: "APPLY", selected: ["color.brand::base"] });
  expect(api.ui.postMessage.mock.calls.at(-1)[0].type).toBe("ERROR");
  expect(api.variables.createVariableCollection).not.toHaveBeenCalled();
});
