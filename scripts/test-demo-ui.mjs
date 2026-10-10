import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "../apps/hospital-demo/node_modules/vite/dist/node/index.js";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const root = fileURLToPath(new URL("../", import.meta.url));
let server;
let browser;
try {
  const app = path.join(root, "apps/hospital-demo");
  server = await createServer({
    root: app,
    configFile: path.join(app, "vite.config.ts"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await page.getByRole("heading", { name: "Care, coordinated." }).waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector("#design-checks")
        ?.textContent?.includes("Checks passed"),
    );
    assert.equal(await page.locator("tbody tr").count(), 3);
    await page
      .getByRole("textbox", { name: "Search appointments" })
      .fill("Jamie");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page
      .getByRole("textbox", { name: "Search appointments" })
      .fill("unknown");
    await page
      .getByText("No matching appointments. Try another search.")
      .waitFor();
    await page.getByRole("textbox", { name: "Search appointments" }).fill("");
    await page.getByRole("button", { name: "Try appointment action" }).click();
    await page.getByRole("button", { name: "Dismiss" }).click();
    const a11y = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      a11y.violations
        .filter((v) => ["critical", "serious"].includes(v.impact))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      JSON.stringify(
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter(
              (el) =>
                el.getBoundingClientRect().right > window.innerWidth &&
                !el.closest(".table-scroll"),
            )
            .map((el) => ({
              tag: el.tagName,
              classes: el.className,
              right: el.getBoundingClientRect().right,
            }))
            .slice(0, 12),
        ),
      ),
    );
    console.log(
      `PASS ${name}: search/actions/report, no page overflow, no serious/critical axe violations`,
    );
  }
  const ui = await readFile(
    path.join(root, "apps/figma-plugin/dist/ui.html"),
    "utf8",
  );
  assert.ok(!/<script[^>]+src=/.test(ui));
  assert.ok(!/<link[^>]+href=["'][^"']+\.css/.test(ui));
  const pluginPage = await context.newPage();
  pluginPage.on("pageerror", (error) => {
    errors.push(`Figma UI: ${error.message}`);
    console.error(error.message);
  });
  await pluginPage.setContent(ui);
  await pluginPage
    .getByRole("heading", { name: "Connect your design system" })
    .waitFor();
  await pluginPage
    .getByRole("button", { name: "Export current document" })
    .waitFor();
  console.log(
    "PASS Figma UI runs from self-contained HTML without an asset server",
  );
  assert.deepEqual(errors, []);
  console.log("3 UI checks passed.");
} finally {
  await browser?.close();
  await server?.close();
}
