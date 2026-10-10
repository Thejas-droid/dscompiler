import { afterEach, describe, expect, test } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  inspectProject,
  scanSource,
  validateContract,
  type Contract,
} from "../src/index.js";
import { compile } from "@dsc/compiler";
const contract: Contract = {
  version: 1,
  name: "Test system",
  properties: {
    color: { types: ["color"], allow: ["inherit"] },
    padding: { types: ["dimension"], allow: [0] },
    "font-size": { types: ["fontSize"] },
  },
  components: [
    {
      from: "@care/ui",
      name: "Button",
      replaces: ["button"],
      variants: { variant: ["primary", "secondary"] },
      forbidProps: ["style"],
    },
  ],
  forbiddenImports: ["@other/ui/**"],
};
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
async function fixture() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "ds-enforcer-test-"));
  dirs.push(cwd);
  await mkdir(path.join(cwd, "src"));
  await mkdir(path.join(cwd, "design-system"));
  await writeFile(
    path.join(cwd, "tokens.json"),
    JSON.stringify({
      color: { brand: { $type: "color", $value: "#0B6B58" } },
      space: { md: { $type: "dimension", $value: "16px" } },
    }),
  );
  await writeFile(
    path.join(cwd, "ds.config.json"),
    JSON.stringify({
      tokens: ["tokens.json"],
      outDir: "generated",
      enforcement: {
        contract: "design-system/contract.json",
        include: ["src/**"],
        exclude: ["src/vendor/**"],
      },
    }),
  );
  await writeFile(
    path.join(cwd, "design-system/contract.json"),
    JSON.stringify(contract),
  );
  await writeFile(
    path.join(cwd, "src/App.tsx"),
    'import {Button} from "@care/ui"; export const App=()=> <main><Button variant="primary">Save</Button></main>;',
  );
  return cwd;
}
async function metadata(cwd: string) {
  return (
    await compile(
      {
        tokens: [path.join(cwd, "tokens.json")],
        outDir: path.join(cwd, "generated"),
      },
      { emit: false },
    )
  ).metadata;
}
describe("source adapters", () => {
  test("checks token references inside nested CSS functions", async () => {
    const cwd = await fixture();
    const result = scanSource(
      "x.css",
      "a{background:color-mix(in srgb,var(--ds-missing),transparent);color:color-mix(in srgb,var(--ds-space-md),transparent)}",
      contract,
      await metadata(cwd),
    );
    expect(result.diagnostics.map((d) => d.code)).toContain("DS_UNKNOWN_TOKEN");
    expect(result.diagnostics.map((d) => d.code)).toContain("DS_TOKEN_TYPE");
    expect(result.diagnostics.map((d) => d.code)).toContain("DS_RAW_STYLE");
  });
  test("spread props on structural HTML cannot hide unchecked styles", () => {
    const result = scanSource(
      "x.tsx",
      "const x=<div {...props}/>;",
      contract,
      [],
    );
    expect(result.unsupported).toBe(true);
    expect(result.diagnostics[0]?.code).toBe("DS_UNSUPPORTED_SOURCE");
  });
  test("reports direct style replacement and DOM styling methods", () => {
    const result = scanSource(
      "x.ts",
      "el.style='color:red'; el.style.setProperty('color','red'); el.setAttribute('style','color:red');",
      contract,
      [],
    );
    expect(
      result.diagnostics.filter((d) => d.code === "DS_UNSUPPORTED_SOURCE"),
    ).toHaveLength(3);
  });
  test("semantic token patterns constrain use beyond token type", async () => {
    const cwd = await fixture();
    const rules = {
      ...contract,
      properties: {
        color: { types: ["color" as const], tokens: ["color.text.*"] },
      },
    };
    expect(
      scanSource(
        "x.css",
        "a{color:var(--ds-color-brand)}",
        rules,
        await metadata(cwd),
      ).diagnostics.some((d) => d.code === "DS_TOKEN_SCOPE"),
    ).toBe(true);
  });
  test("runtime style mutation and injected markup are reported as unsupported", () => {
    const result = scanSource(
      "x.tsx",
      'React.createElement("div",{style:dynamic}); el.style.color="red"; const x=<div dangerouslySetInnerHTML={{__html:html}}/>;',
      contract,
      [],
    );
    expect(
      result.diagnostics.filter((d) => d.code === "DS_UNSUPPORTED_SOURCE"),
    ).toHaveLength(3);
  });

  test("accepts known tokens, CSS globals explicitly allowed, structural HTML and imported alias", async () => {
    const cwd = await fixture();
    const result = scanSource(
      "src/App.tsx",
      'import {Button as Save} from "@care/ui"; const x=<main style={{color:"var(--ds-color-brand)",padding:0}}><Save variant="primary"/></main>;',
      contract,
      await metadata(cwd),
    );
    expect(result.diagnostics).toEqual([]);
  });
  test("detects raw values and unknown variables with line positions", async () => {
    const cwd = await fixture();
    const result = scanSource(
      "src/style.css",
      ".card {\ncolor:#ff00ff;\npadding:13px;\nbackground:var(--ds-missing);\n}",
      contract,
      await metadata(cwd),
    );
    expect(result.diagnostics.map((d) => d.code)).toEqual([
      "DS_RAW_STYLE",
      "DS_RAW_STYLE",
      "DS_UNKNOWN_TOKEN",
    ]);
    expect(result.diagnostics[0]?.source).toMatchObject({
      file: "src/style.css",
      line: 2,
      column: 1,
    });
  });
  test("does not accept a valid token paired with arbitrary literals or raw fallbacks", async () => {
    const cwd = await fixture();
    const result = scanSource(
      "x.css",
      "a{padding:var(--ds-space-md) 13px;color:var(--ds-color-brand,#ff00ff)}",
      contract,
      await metadata(cwd),
    );
    expect(
      result.diagnostics.filter((d) => d.code === "DS_RAW_STYLE"),
    ).toHaveLength(2);
  });
  test("rejects a token of the wrong type", async () => {
    const cwd = await fixture();
    expect(
      scanSource(
        "x.css",
        "a{color:var(--ds-space-md)}",
        contract,
        await metadata(cwd),
      ).diagnostics.some((d) => d.code === "DS_TOKEN_TYPE"),
    ).toBe(true);
  });
  test("rejects consumer variable overrides", async () => {
    const cwd = await fixture();
    expect(
      scanSource(
        "x.css",
        ":root{--ds-color-brand:#fff}",
        contract,
        await metadata(cwd),
      ).diagnostics[0]?.code,
    ).toBe("DS_RESTRICTED_PROP");
  });
  test("checks native controls, aliases, forbidden imports, variants and restricted props", () => {
    const result = scanSource(
      "x.tsx",
      'import { Button as Save } from "@care/ui"; import X from "@other/ui/button"; const x=<><button/><Save variant="large" style={{padding:13}}/></>;',
      contract,
      [],
    );
    expect(new Set(result.diagnostics.map((d) => d.code))).toEqual(
      new Set([
        "DS_UNAPPROVED_COMPONENT",
        "DS_INVALID_VARIANT",
        "DS_RESTRICTED_PROP",
        "DS_RAW_STYLE",
      ]),
    );
  });
  test("checks namespace component imports", () => {
    expect(
      scanSource(
        "x.tsx",
        'import * as UI from "@care/ui"; const x=<UI.Button variant="bad"/>;',
        contract,
        [],
      ).diagnostics[0]?.code,
    ).toBe("DS_INVALID_VARIANT");
  });
  test("reports dynamic values, spread styles, spread props and variants as unsupported", () => {
    const result = scanSource(
      "x.tsx",
      'import {Button} from "@care/ui"; const x=<><div style={{...s,color:value}}/><Button {...p} variant={variant}/><div style={s}/></>;',
      contract,
      [],
    );
    expect(result.unsupported).toBe(true);
    expect(
      result.diagnostics.filter((d) => d.code === "DS_UNSUPPORTED_SOURCE"),
    ).toHaveLength(5);
  });
  test("reports CSS-in-JS and stylesheet preprocessors as unsupported", () => {
    expect(scanSource("x.scss", "$brand:red;", contract, []).unsupported).toBe(
      true,
    );
    expect(
      scanSource(
        "x.tsx",
        'import styled from "styled-components"; const C=styled.div`color:red`;',
        contract,
        [],
      ).unsupported,
    ).toBe(true);
  });
  test("detects malformed CSS and TSX instead of claiming a clean scan", () => {
    expect(
      scanSource("x.css", "a { color:", contract, []).diagnostics[0]?.code,
    ).toBe("DS_SOURCE_PARSE_ERROR");
    expect(
      scanSource("x.tsx", "const x=<div>", contract, []).diagnostics.some(
        (d) => d.code === "DS_SOURCE_PARSE_ERROR",
      ),
    ).toBe(true);
  });
});
describe("inspection policy and contract tracking", () => {
  test("a configured missing theme directory fails even warning mode", async () => {
    const cwd = await fixture();
    await writeFile(
      path.join(cwd, "ds.config.json"),
      JSON.stringify({
        tokens: ["tokens.json"],
        themes: "missing-themes",
        enforcement: {
          contract: "design-system/contract.json",
          include: ["src/**"],
        },
      }),
    );
    const result = await inspectProject({ cwd, mode: "warn" });
    expect(result.ready).toBe(false);
    expect(result.passed).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === "DS_BASELINE_INVALID"),
    ).toBe(true);
  });
  test("an empty token baseline cannot report verified consumer source", async () => {
    const cwd = await fixture();
    await writeFile(path.join(cwd, "tokens.json"), "{}");
    const result = await inspectProject({ cwd, mode: "warn" });
    expect(result.passed).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === "DS_BASELINE_INVALID"),
    ).toBe(true);
  });
  test("approved component implementation changes update the baseline revision", async () => {
    const cwd = await fixture();
    await mkdir(path.join(cwd, "src/vendor"));
    const file = path.join(cwd, "src/vendor/button.tsx");
    await writeFile(file, "export const Button=()=>null;");
    await writeFile(
      path.join(cwd, "design-system/contract.json"),
      JSON.stringify({ ...contract, implementation: ["src/vendor/**"] }),
    );
    const first = await inspectProject({ cwd });
    expect(first.passed).toBe(true);
    await writeFile(file, "export const Button=()=> <button/>;");
    const next = await inspectProject({ cwd });
    expect(next.passed).toBe(true);
    expect(next.contractHash).not.toBe(first.contractHash);
  });

  test("strict fails on violations while warning mode permits startup", async () => {
    const cwd = await fixture();
    await writeFile(path.join(cwd, "src/style.css"), "a{color:#ff00ff}");
    expect((await inspectProject({ cwd, mode: "strict" })).passed).toBe(false);
    const warn = await inspectProject({ cwd, mode: "warn" });
    expect(warn.passed).toBe(true);
    expect(warn.diagnostics[0]?.code).toBe("DS_RAW_STYLE");
  });
  test("consumer changes do not change the approved hash; approved token changes do", async () => {
    const cwd = await fixture();
    const first = await inspectProject({ cwd });
    await writeFile(path.join(cwd, "src/style.css"), "a{color:#ff00ff}");
    const changed = await inspectProject({ cwd });
    expect(changed.contractHash).toBe(first.contractHash);
    await writeFile(
      path.join(cwd, "tokens.json"),
      JSON.stringify({
        color: { brand: { $type: "color", $value: "#111111" } },
      }),
    );
    expect((await inspectProject({ cwd })).contractHash).not.toBe(
      first.contractHash,
    );
  });
  test("hash is independent of absolute checkout paths", async () => {
    const a = await fixture();
    const b = await fixture();
    expect((await inspectProject({ cwd: a })).contractHash).toBe(
      (await inspectProject({ cwd: b })).contractHash,
    );
  });
  test("deleting a violating file removes stale diagnostics", async () => {
    const cwd = await fixture();
    const file = path.join(cwd, "src/style.css");
    await writeFile(file, "a{color:red}");
    expect((await inspectProject({ cwd })).passed).toBe(false);
    await rm(file);
    expect((await inspectProject({ cwd })).passed).toBe(true);
  });
  test("explicit exclusions are recorded", async () => {
    const cwd = await fixture();
    await mkdir(path.join(cwd, "src/vendor"));
    await writeFile(path.join(cwd, "src/vendor/library.css"), "a{color:red}");
    const report = await inspectProject({ cwd });
    expect(report.passed).toBe(true);
    expect(report.coverage.excluded).toContain("src/vendor/");
  });
  test("unexpired exceptions record reason, expiry and suppressed diagnostic", async () => {
    const cwd = await fixture();
    await writeFile(path.join(cwd, "src/style.css"), "a{color:red}");
    await writeFile(
      path.join(cwd, "design-system/contract.json"),
      JSON.stringify({
        ...contract,
        exceptions: [
          {
            files: ["src/style.css"],
            rules: ["DS_RAW_STYLE"],
            reason: "Legacy migration",
            expires: "2030-01-01",
          },
        ],
      }),
    );
    const result = await inspectProject({ cwd, now: new Date("2026-10-10") });
    expect(result.passed).toBe(true);
    expect(result.suppressed[0]).toMatchObject({
      reason: "Legacy migration",
      expires: "2030-01-01",
    });
  });
  test("expired exceptions fail even warning mode", async () => {
    const cwd = await fixture();
    await writeFile(
      path.join(cwd, "design-system/contract.json"),
      JSON.stringify({
        ...contract,
        exceptions: [
          {
            files: ["src/**"],
            rules: ["DS_RAW_STYLE"],
            reason: "Old migration",
            expires: "2020-01-01",
          },
        ],
      }),
    );
    const result = await inspectProject({ cwd, mode: "warn" });
    expect(result.passed).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === "DS_EXPIRED_EXCEPTION"),
    ).toBe(true);
  });
  test("invalid baseline fails in warning mode and is recoverable", async () => {
    const cwd = await fixture();
    await writeFile(
      path.join(cwd, "tokens.json"),
      JSON.stringify({
        color: { brand: { $type: "color", $value: "{missing}" } },
      }),
    );
    const result = await inspectProject({ cwd, mode: "warn" });
    expect(result.passed).toBe(false);
    expect(result.ready).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === "TOKEN_REFERENCE_MISSING"),
    ).toBe(true);
  });
  test("missing contract, misspelled settings and empty scan fail closed", async () => {
    const cwd = await fixture();
    await rm(path.join(cwd, "design-system/contract.json"));
    expect((await inspectProject({ cwd, mode: "warn" })).passed).toBe(false);
    await writeFile(
      path.join(cwd, "design-system/contract.json"),
      JSON.stringify({ ...contract, propertiez: {} }),
    );
    expect(
      (await inspectProject({ cwd })).diagnostics.some(
        (d) => d.code === "DS_BASELINE_INVALID",
      ),
    ).toBe(true);
    await writeFile(
      path.join(cwd, "design-system/contract.json"),
      JSON.stringify(contract),
    );
    await rm(path.join(cwd, "src/App.tsx"));
    expect(
      (await inspectProject({ cwd, mode: "warn" })).diagnostics.some(
        (d) => d.code === "DS_EMPTY_SCAN",
      ),
    ).toBe(true);
  });
  test("unsupported files appear in coverage and can fail a strict warning gate", async () => {
    const cwd = await fixture();
    await writeFile(path.join(cwd, "src/styles.scss"), "$x:1;");
    const result = await inspectProject({ cwd, failOnWarnings: true });
    expect(result.passed).toBe(false);
    expect(result.coverage.unsupported).toEqual(["src/styles.scss"]);
  });
  test.skipIf(process.platform === "win32")(
    "symlinks are not followed outside the project",
    async () => {
      const cwd = await fixture();
      await symlink(
        path.join(cwd, "tokens.json"),
        path.join(cwd, "src/link.css"),
      );
      await writeFile(
        path.join(cwd, "design-system/contract.json"),
        JSON.stringify({
          ...contract,
          rules: { DS_UNSUPPORTED_SOURCE: "error" },
        }),
      );
      const result = await inspectProject({ cwd });
      expect(result.coverage.unsupported).toContain("src/link.css");
      expect(
        result.diagnostics.find((d) => d.code === "DS_UNSUPPORTED_SOURCE")
          ?.severity,
      ).toBe("error");
      expect(result.passed).toBe(false);
    },
  );
  test("contract rejects unknown rules, unsafe globs and impossible dates", () => {
    for (const addition of [
      { rules: { UNKNOWN: "off" } },
      {
        exceptions: [
          {
            files: ["../**"],
            rules: ["DS_RAW_STYLE"],
            reason: "x",
            expires: "2030-01-01",
          },
        ],
      },
      {
        exceptions: [
          {
            files: ["src/**"],
            rules: ["DS_RAW_STYLE"],
            reason: "x",
            expires: "2030-02-31",
          },
        ],
      },
    ])
      expect(() => validateContract({ ...contract, ...addition })).toThrow();
  });
});
