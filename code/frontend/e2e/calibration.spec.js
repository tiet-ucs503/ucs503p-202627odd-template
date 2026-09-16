// Playwright E2E tests for personal biomechanics calibration workflow.
import { test, expect } from "@playwright/test";
import { authenticatePage } from "./test-helpers.js";

test.describe("Calibration Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await authenticatePage(page);
  });
  test("runs through standing and bottom pose capture and saves baseline", async ({ page }) => {
    await page.goto("/");

    // Navigate to calibration tab
    const calTab = page.getByTestId("tab-calibration");
    await calTab.click();

    const calView = page.getByTestId("calibration-view");
    await expect(calView).toBeVisible();

    // Step 1: Standing pose
    const captureStandingBtn = page.getByTestId("btn-capture-standing");
    await expect(captureStandingBtn).toBeVisible();
    await captureStandingBtn.click();

    // Step 2: Bottom pose
    const captureBottomBtn = page.getByTestId("btn-capture-bottom");
    await expect(captureBottomBtn).toBeVisible();
    await captureBottomBtn.click();

    // Step 3: Baseline summary
    const results = page.getByTestId("baseline-results");
    await expect(results).toBeVisible();
    await expect(results).toContainText("Femur-to-Torso Ratio");
    await expect(results).toContainText("Standing Knee Angle");

    // Save baseline
    const saveBaselineBtn = page.getByTestId("btn-save-baseline");
    await expect(saveBaselineBtn).toBeVisible();
    await saveBaselineBtn.click();
  });
});
