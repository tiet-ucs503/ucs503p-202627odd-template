// Playwright E2E tests for workout set start, finish, and session summary.
import { test, expect } from "@playwright/test";
import { authenticatePage } from "./test-helpers.js";

test.describe("Workout Session Flow", () => {
  test.beforeEach(async ({ page }) => {
    await authenticatePage(page);
  });
  test("starts a workout set, ends the set, and opens session summary review modal", async ({ page }) => {
    await page.goto("/");

    const startBtn = page.getByTestId("btn-start-set");
    await expect(startBtn).toBeVisible();

    // Start set
    await startBtn.click();

    // End set button appears
    const endBtn = page.getByTestId("btn-end-set");
    await expect(endBtn).toBeVisible();
    await expect(endBtn).toContainText("End Set");

    // End set
    await endBtn.click();

    // Session summary modal opens
    const modal = page.getByTestId("session-summary-modal");
    await expect(modal).toBeVisible();

    // Verify summary stat items
    await expect(page.getByTestId("summary-exercise")).toHaveText("SQUAT");
    await expect(page.getByTestId("summary-reps")).toHaveText("0");
    await expect(page.getByTestId("summary-score")).toContainText("%");

    // Save session button
    const saveBtn = page.getByTestId("btn-save-session");
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Save confirmation
    const saveStatus = page.getByTestId("save-status");
    await expect(saveStatus).toBeVisible();
    await expect(saveStatus).toHaveText("Session saved to profile!");

    // Close summary modal
    const closeBtn = page.getByTestId("btn-close-summary");
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
