import { test, expect } from "@playwright/test";

test("dashboard shell is reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Distributed Ops Control Platform" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reconciliation" })).toBeVisible();
});