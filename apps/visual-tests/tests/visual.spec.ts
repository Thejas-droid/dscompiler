import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test.describe(theme, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/?theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByTestId("button-matrix")).toHaveCSS(
        "background-color",
        theme === "dark" ? "rgb(15, 23, 42)" : "rgb(255, 255, 255)",
      );
    });
    test("button states", async ({ page }) => {
      const area = page.getByTestId("button-matrix");
      await expect(area).toHaveScreenshot(`button-default-${theme}.png`);
      const primary = area.getByRole("button", { name: "Primary" });
      await primary.hover();
      await expect(area).toHaveScreenshot(`button-hover-${theme}.png`);
      await primary.focus();
      await expect(area).toHaveScreenshot(`button-focus-${theme}.png`);
    });
    test("dialog", async ({ page }) => {
      await page.getByRole("button", { name: "Open dialog" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Confirm action");
      await expect(
        dialog.getByRole("button", { name: "Confirm", exact: true }),
      ).toBeVisible();
      const bounds = await dialog.boundingBox();
      const viewport = page.viewportSize()!;
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      // Capture fixed positioning, overlay, and dialog content together.
      await expect(page).toHaveScreenshot(`dialog-${theme}.png`);
    });
  });
}
