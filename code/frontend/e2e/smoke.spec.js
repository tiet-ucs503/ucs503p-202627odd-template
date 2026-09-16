import { test, expect } from "@playwright/test";
import { authenticatePage } from "./test-helpers.js";

test("app shell loads, shows disclaimer, and does not crash", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err));

  await authenticatePage(page);

  await page.goto("/");

  await expect(page.getByTestId("app-root")).toBeVisible();
  await expect(page.getByTestId("disclaimer")).toBeVisible();
  await expect(page.getByTestId("disclaimer")).toContainText("Not a medical device");

  // Either the pose pipeline comes up (knee-angle readout) or a camera-state
  // message is shown (e.g. permission/device/model issue) — either is a
  // valid non-crashing outcome for this smoke test.
  const readout = page.getByTestId("knee-angle-readout");
  const statusMessage = page.getByTestId("camera-status");
  await expect(readout.or(statusMessage)).toBeVisible({ timeout: 15_000 });

  expect(pageErrors).toEqual([]);
});
