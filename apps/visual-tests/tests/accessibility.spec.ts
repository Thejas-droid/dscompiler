import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test("component examples have no serious or critical axe violations", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(blocking).toEqual([]);
});
test("dialog traps focus, closes on Escape, and restores trigger focus", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open dialog" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const confirm = dialog.getByRole("button", { name: "Confirm", exact: true });
  await cancel.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
test("tabs support arrow-key navigation", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("tab", { name: "Overview" });
  const second = page.getByRole("tab", { name: "Activity" });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-selected", "true");
});
