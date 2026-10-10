import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("first visit explains the workflow and lets users start exploring", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your design system, explained" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Design once. Use it everywhere." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore your tokens" }).click();
  await expect(
    page.getByRole("heading", { name: "Explore the values behind your UI" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Your design system, explained" }),
  ).toBeVisible();
});

test("tokens can be searched, inspected, and filtered with an empty-state recovery", async ({
  page,
}) => {
  await page.goto("/#tokens");
  await page
    .getByRole("textbox", { name: "Search tokens" })
    .fill("color.background.surface");
  await expect(
    page.getByRole("region", { name: "Token results" }).getByRole("button"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Selected token details" }),
  ).toContainText("color.background.surface");
  await expect(
    page.getByRole("region", { name: "Selected token details" }),
  ).toContainText("tokens/semantic.json");
  await page
    .getByRole("textbox", { name: "Search tokens" })
    .fill("no-such-token-123");
  await expect(
    page.getByRole("heading", { name: "No matching tokens" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Semantic", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Semantic", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("region", { name: "Selected token details" }),
  ).toContainText("semantic");
});

test("component token links open the correct token", async ({ page }) => {
  await page.goto("/#components");
  await page.getByRole("link", { name: "radius.control", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Selected token details" }),
  ).toContainText("radius.control");
  await expect(
    page.getByRole("region", { name: "Selected token details" }),
  ).toContainText("border-radius");
});

test("theme choices change actual previews and survive a reload", async ({
  page,
}) => {
  await page.goto("/#themes");
  await page
    .getByRole("combobox", { name: "Preview theme" })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Selected dark" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Preview theme" }),
  ).toHaveValue("dark");
  await page.getByRole("button", { name: "Use theme light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("table")).toContainText(
    "color.background.surface",
  );
});

test("real components support mouse and keyboard interactions", async ({
  page,
}) => {
  await page.goto("/#components");
  await page
    .getByRole("button", { name: "Primary button", exact: true })
    .click();
  await expect(
    page.getByText("Button activated 1 time.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "Notifications" });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await page.getByRole("button", { name: "Dialog", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Open example dialog" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Tabs", exact: true }).click();
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Activity" })).toBeFocused();
});

test("test guide offers real commands and an honest manual checklist", async ({
  page,
}) => {
  await page.goto("/#testing");
  await expect(
    page.getByRole("heading", { name: "Make one change. See the result." }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("pnpm run docs");
  await expect(
    page.locator(".guide-step").nth(3).locator("pre code"),
  ).toHaveText(
    "pnpm ds check --skip-browser\npnpm --filter @dsc/compiler test",
  );
  for (const checkbox of await page.locator(".checklist input").all())
    await checkbox.check();
  await expect(page.locator(".checklist [role=status]")).toHaveText(
    "Practice checklist complete. Nice work!",
  );
});

test("copy failures explain how to recover", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.goto("/#tokens");
  await page.getByRole("button", { name: "Copy CSS usage" }).click();
  await expect(page.locator(".copy-error")).toHaveText(
    "Copy unavailable. Select the text to copy.",
  );
});

test("missing generated data gives a recovery path and retry works", async ({
  page,
}) => {
  await page.route("**/data/tokens.json", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("pnpm ds build");
  await page.unroute("**/data/tokens.json");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Design once. Use it everywhere." }),
  ).toBeVisible();
});

for (const section of ["start", "tokens", "themes", "components", "testing"]) {
  test(`${section} has no serious accessibility violations or page overflow`, async ({
    page,
  }) => {
    await page.goto(`/#${section}`);
    await expect(
      page.getByText("From your project", { exact: true }),
    ).toBeAttached();
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });
}

test("copy success writes the real CSS snippet", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#tokens");
  await page.getByRole("button", { name: "Copy CSS usage" }).click();
  await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "var(--ds-color-button-primary-background)",
  );
});

test("all registry examples render without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#components");
  await page
    .getByRole("button", { name: "Primary button", exact: true })
    .waitFor();
  for (const option of await page.locator(".component-options button").all()) {
    await option.click();
    await expect(page.locator(".component-stage")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("an HTML fallback explains that generated data is missing", async ({
  page,
}) => {
  await page.route("**/data/tokens.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Vite fallback</body></html>",
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "The generated documentation files are missing.",
  );
  await expect(page.getByRole("alert")).not.toContainText("Unexpected token");
});
