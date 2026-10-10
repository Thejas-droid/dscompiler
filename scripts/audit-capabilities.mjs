import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(root, "packages", "cli", "dist", "index.js");
try {
  await readFile(cli);
} catch {
  console.error(
    "Build the project first with `pnpm build`, then rerun this audit.",
  );
  process.exit(1);
}
const directory = await mkdtemp(
  path.join(os.tmpdir(), "dsc-capability-audit-"),
);
const results = [];
const validTokens = {
  color: {
    brand: { $type: "color", $value: "#7224D8" },
    action: { $type: "color", $value: "{color.brand}" },
  },
};
async function writeTokens(tokens) {
  await writeFile(
    path.join(directory, "tokens.json"),
    JSON.stringify(tokens, null, 2),
  );
}
function run(args) {
  const result = spawnSync(
    process.execPath,
    [cli, "--cwd", directory, ...args],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 30000,
    },
  );
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}
try {
  await mkdir(path.join(directory, "src"));
  await writeFile(
    path.join(directory, "ds.config.json"),
    JSON.stringify({
      tokens: ["./tokens.json"],
      outDir: "./generated",
      css: { prefix: "ds" },
    }),
  );
  await writeTokens(validTokens);
  const build = run(["build"]);
  assert.equal(build.status, 0, build.output);
  const css = await readFile(
    path.join(directory, "generated", "tokens.css"),
    "utf8",
  );
  assert.match(css, /--ds-color-action: #7224D8/);
  results.push({
    capability: "Compile tokens and resolve aliases",
    status: "IMPLEMENTED",
    evidence: build.output,
  });

  await writeFile(
    path.join(directory, "src", "Probe.tsx"),
    'export function Probe() { return <button style={{color: "#ff00ff", padding: "13px"}}>Unapproved control</button>; }\n',
  );
  await writeFile(
    path.join(directory, "src", "styles.css"),
    ".probe { color: #ff00ff; padding: 13px; background: var(--ds-color-does-not-exist); }\n",
  );
  const lint = run(["lint"]);
  assert.equal(lint.status, 0, lint.output);
  results.push({
    capability:
      "Check consumer styles, unknown CSS variables and component usage",
    status: "TOKEN-ONLY CHECK",
    evidence: `Consumer files contain intentional policy violations, but ds lint exits 0: ${lint.output}`,
  });
  const check = run(["check", "--skip-browser"]);
  assert.equal(check.status, 0, check.output);
  results.push({
    capability: "Check generated output drift",
    status: "IMPLEMENTED",
    evidence: check.output,
  });
  results.push({
    capability:
      "Use ds check without an enforcement contract as a consumer-source gate",
    status: "TOKEN-ONLY CHECK",
    evidence:
      "ds check --skip-browser exits 0 despite the intentionally nonconforming consumer source.",
  });

  await writeFile(
    path.join(directory, "contract.json"),
    JSON.stringify({
      version: 1,
      name: "Audit contract",
      properties: {
        color: { types: ["color"] },
        padding: { types: ["dimension"] },
      },
      components: [{ from: "@care/ui", name: "Button", replaces: ["button"] }],
    }),
  );
  await writeFile(
    path.join(directory, "ds.config.json"),
    JSON.stringify({
      tokens: ["./tokens.json"],
      outDir: "./generated",
      css: { prefix: "ds" },
      enforcement: { contract: "contract.json", include: ["src/**"] },
    }),
  );
  const inspected = run(["inspect", "--mode", "strict", "--json"]);
  assert.equal(inspected.status, 1, inspected.output);
  const report = JSON.parse(inspected.output);
  for (const code of [
    "DS_RAW_STYLE",
    "DS_UNKNOWN_TOKEN",
    "DS_UNAPPROVED_COMPONENT",
  ])
    assert.ok(
      report.diagnostics.some((d) => d.code === code),
      `Expected ${code}`,
    );
  results.push({
    capability: "Enforce consumer CSS/JSX against an approved contract",
    status: "IMPLEMENTED",
    evidence: `inspect exits 1 and detects ${[...new Set(report.diagnostics.map((d) => d.code))].join(", ")}.`,
  });
  const warning = run(["inspect", "--mode", "warn"]);
  assert.equal(warning.status, 0, warning.output);
  results.push({
    capability: "Warn before startup without blocking development",
    status: "IMPLEMENTED",
    evidence: warning.output,
  });

  await writeTokens({
    color: { action: { $type: "color", $value: "{color.missing}" } },
  });
  const missing = run(["lint"]);
  assert.equal(missing.status, 1, missing.output);
  assert.match(missing.output, /TOKEN_REFERENCE_MISSING/);
  results.push({
    capability: "Reject undefined references inside token definitions",
    status: "IMPLEMENTED",
    evidence: missing.output,
  });

  await writeTokens({
    color: {
      a: { $type: "color", $value: "{color.b}" },
      b: { $type: "color", $value: "{color.a}" },
    },
  });
  const cycle = run(["lint"]);
  assert.equal(cycle.status, 1, cycle.output);
  assert.match(cycle.output, /TOKEN_CYCLE/);
  results.push({
    capability: "Reject cyclic token references",
    status: "IMPLEMENTED",
    evidence: cycle.output,
  });

  if (process.argv.includes("--json"))
    console.log(JSON.stringify(results, null, 2));
  else {
    console.log("Design-System Compiler capability audit\n");
    for (const result of results)
      console.log(
        `${result.status}: ${result.capability}\n  ${result.evidence.replaceAll("\n", "\n  ")}\n`,
      );
    console.log(
      "Audit passed. lint/check without enforcement configured remain token-only checks; inspect supplies consumer enforcement.",
    );
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
