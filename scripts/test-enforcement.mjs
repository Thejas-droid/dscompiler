import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  createServer,
  build,
} from "../apps/hospital-demo/node_modules/vite/dist/node/index.js";
import { designSystem } from "../packages/enforcer/dist/vite.js";
import { chromium } from "@playwright/test";
const root = fileURLToPath(new URL("../", import.meta.url));
const cwd = await mkdtemp(path.join(os.tmpdir(), "ds-live-integration-"));
let server;
let browser;
let tests = 0;
const ok = (message) => {
  tests++;
  console.log(`PASS ${message}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const write = (name, value) => writeFile(path.join(cwd, name), value);
const run = (args) => {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "packages/cli/dist/index.js"), "--cwd", cwd, ...args],
    { encoding: "utf8", timeout: 30000 },
  );
  if (result.error) throw result.error;
  return result;
};
async function eventually(check, message) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error(`Timed out: ${message}`);
}
try {
  await mkdir(path.join(cwd, "src"));
  await write(
    "tokens.json",
    JSON.stringify({ color: { brand: { $type: "color", $value: "#0B6B58" } } }),
  );
  await write(
    "contract.json",
    JSON.stringify({
      version: 1,
      name: "Live test contract",
      properties: { color: { types: ["color"] } },
      components: [],
    }),
  );
  await write(
    "ds.config.json",
    JSON.stringify({
      tokens: ["tokens.json"],
      outDir: "generated",
      enforcement: { contract: "contract.json", include: ["src/**"] },
    }),
  );
  await write(
    "index.html",
    '<html lang="en"><head><title>Live integration</title></head><body><main><h1>Live checks</h1><p class="probe">Approved color</p></main><script type="module" src="/src/main.js"></script></body></html>',
  );
  await write(
    "src/main.js",
    'import "../generated/tokens.css"; import "./style.css";',
  );
  await write("src/style.css", ".probe{color:#ff00ff}");
  let flagResult = run(["inspect", "--mdoe", "strict"]);
  assert.equal(flagResult.status, 1);
  assert.match(flagResult.stderr, /Unknown option/);
  ok("misspelled CLI enforcement flags fail closed");
  const sample = JSON.parse(
    await readFile(path.join(root, "fixtures/figma/snapshot.json"), "utf8"),
  );
  const mapping = JSON.parse(
    await readFile(path.join(root, "fixtures/figma/mapping.json"), "utf8"),
  );
  await write("figma.json", JSON.stringify(sample));
  await write("mapping.json", JSON.stringify(mapping));
  let imported = run([
    "import-figma",
    "figma.json",
    "--mapping",
    "mapping.json",
    "--out",
    "candidate",
  ]);
  assert.equal(imported.status, 0, imported.stderr);
  assert.ok(
    (await readFile(path.join(cwd, "candidate/tokens.json"), "utf8")).includes(
      "{color.brand}",
    ),
  );
  ok("Figma CLI import validates candidate tokens and preserves aliases");
  imported = run([
    "import-figma",
    "figma.json",
    "--mapping",
    "mapping.json",
    "--out",
    "candidate",
  ]);
  assert.equal(imported.status, 1);
  ok("Figma import refuses to overwrite an existing candidate");
  sample.variables[0].valuesByMode["mode:light"] = {
    type: "VARIABLE_ALIAS",
    id: "variable:action",
  };
  await write("figma.json", JSON.stringify(sample));
  imported = run([
    "import-figma",
    "figma.json",
    "--mapping",
    "mapping.json",
    "--out",
    "invalid-candidate",
  ]);
  assert.equal(imported.status, 1);
  assert.match(imported.stderr, /TOKEN_CYCLE/);
  await assert.rejects(() =>
    readFile(path.join(cwd, "invalid-candidate/tokens.json")),
  );
  ok("invalid Figma candidate is rejected and cleaned up");

  let result = run(["inspect", "--mode", "strict", "--json"]);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.stdout, result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, false);
  ok("strict CLI exits 1 with machine-readable diagnostics");
  result = run([
    "inspect",
    "--mode",
    "warn",
    "--report",
    "reports/result.json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(await readFile(path.join(cwd, "reports/result.json"), "utf8"))
      .diagnostics[0].code,
    "DS_RAW_STYLE",
  );
  ok("warning startup exits 0 and persists JSON report");
  await assert.rejects(
    () =>
      createServer({
        root: cwd,
        configFile: false,
        plugins: [designSystem({ devMode: "strict" })],
        logLevel: "silent",
      }),
    /DS_RAW_STYLE/,
  );
  ok("strict Vite startup rejects nonconforming source");
  await assert.rejects(
    () =>
      build({
        root: cwd,
        configFile: false,
        plugins: [designSystem()],
        logLevel: "silent",
      }),
    /DS_RAW_STYLE/,
  );
  ok("production build blocks violations even with default warning dev policy");
  server = await createServer({
    root: cwd,
    configFile: false,
    plugins: [designSystem()],
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer.address();
  assert.equal(typeof address, "object");
  const url = `http://127.0.0.1:${address.port}`;
  const getReport = () => fetch(`${url}/__ds/report`).then((r) => r.json());
  let report = await getReport();
  assert.equal(report.diagnostics[0].code, "DS_RAW_STYLE");
  const hash = report.contractHash;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await eventually(
    () =>
      page
        .locator("#dsc-indicator summary")
        .textContent()
        .then((t) => t.includes("1 errors")),
    "browser receives initial violation",
  );
  ok(
    "warning dev server runs and browser indicator explains initial violation",
  );
  await write("src/style.css", ".probe{color:var(--ds-color-brand)}");
  await eventually(
    async () => !(await getReport()).diagnostics.length,
    "resolved diagnostic removed",
  );
  await eventually(
    () =>
      page
        .locator("#dsc-indicator summary")
        .textContent()
        .then((t) => t.includes("checks passed")),
    "browser clears violation",
  );
  assert.equal((await getReport()).contractHash, hash);
  ok(
    "fix clears terminal/report/browser diagnostics without changing approved revision",
  );
  await write("src/new.css", ".bad{color:var(--ds-color-missing)}");
  await eventually(
    async () =>
      (await getReport()).diagnostics.some(
        (d) => d.code === "DS_UNKNOWN_TOKEN",
      ),
    "new file checked",
  );
  await rm(path.join(cwd, "src/new.css"));
  await eventually(
    async () => !(await getReport()).diagnostics.length,
    "deleted file clears diagnostic",
  );
  ok("new and deleted files update diagnostics");
  await write(
    "tokens.json",
    JSON.stringify({ color: { brand: { $type: "color", $value: "#123456" } } }),
  );
  await eventually(
    async () => (await getReport()).contractHash !== hash,
    "baseline revision refreshes",
  );
  await eventually(
    () =>
      page
        .locator(".probe")
        .evaluate((el) => getComputedStyle(el).color)
        .then((color) => color === "rgb(18, 52, 86)"),
    "approved token updates actual style",
  );
  ok("approved token edits regenerate CSS and update rendered styles");
  await write(
    "tokens.json",
    JSON.stringify({
      color: { brand: { $type: "color", $value: "{missing}" } },
    }),
  );
  await eventually(
    async () => !(await getReport()).ready,
    "invalid baseline reported",
  );
  await write(
    "tokens.json",
    JSON.stringify({ color: { brand: { $type: "color", $value: "#123456" } } }),
  );
  await eventually(async () => (await getReport()).ready, "baseline recovers");
  ok("invalid live baseline reports failure and recovers after correction");
  assert.deepEqual(errors, []);
  ok("browser integration has no uncaught page errors");
  await browser.close();
  browser = undefined;
  await server.close();
  server = undefined;
  const artifacts = await build({
    root: cwd,
    configFile: false,
    plugins: [designSystem()],
    logLevel: "silent",
    build: { write: false },
  });
  const outputs = Array.isArray(artifacts) ? artifacts : [artifacts];
  const content = outputs
    .flatMap((result) => result.output)
    .map((o) => (o.type === "chunk" ? o.code : String(o.source)))
    .join("\n");
  assert.ok(
    !content.includes("dsc-indicator") && !content.includes("__ds/report"),
  );
  ok("production output excludes diagnostic endpoint/client/indicator");
  // Non-root deployment paths retain the live report connection.
  server = await createServer({
    root: cwd,
    base: "/hospital/",
    configFile: false,
    plugins: [designSystem()],
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const baseAddress = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${baseAddress.port}/hospital/`;
  browser = await chromium.launch({ headless: true });
  const basePage = await browser.newPage();
  await basePage.goto(baseUrl);
  await eventually(
    () =>
      basePage
        .locator("#dsc-indicator summary")
        .textContent()
        .then((t) => t.includes("checks passed")),
    "non-root base report",
  );
  ok("live indicator works with a non-root Vite base");
  console.log(`${tests} integration checks passed.`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(cwd, { recursive: true, force: true });
}
