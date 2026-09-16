// Playwright E2E tests for navigation to Dashboard and metrics display.
import { test, expect } from "@playwright/test";
import { authenticatePage } from "./test-helpers.js";

test.describe("Dashboard Navigation & Stats", () => {
  test.beforeEach(async ({ page }) => {
    await authenticatePage(page);
  });
  test("navigates to Dashboard tab and displays metrics cards", async ({ page }) => {
    await page.goto("/");

    const dashboardTab = page.getByTestId("tab-dashboard");
    await expect(dashboardTab).toBeVisible();
    await dashboardTab.click();

    // Dashboard view container
    const dashboardView = page.getByTestId("dashboard-view");
    await expect(dashboardView).toBeVisible();

    // Summary cards
    await expect(page.getByTestId("stat-total-sessions")).toBeVisible();
    await expect(page.getByTestId("stat-total-reps")).toBeVisible();
    await expect(page.getByTestId("stat-avg-score")).toBeVisible();
  });
});
