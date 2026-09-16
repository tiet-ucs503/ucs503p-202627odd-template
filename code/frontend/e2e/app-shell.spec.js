import { test, expect } from "@playwright/test";
import { authenticatePage } from "./test-helpers.js";

test.describe("App Shell & UI Layout", () => {
  test.beforeEach(async ({ page }) => {
    await authenticatePage(page);
  });
  test("renders the app header, title, and medical disclaimer", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/");

    // Verify root container
    const appRoot = page.getByTestId("app-root");
    await expect(appRoot).toBeVisible();

    // Verify title
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Squat Form Analyzer");

    // Verify medical disclaimer
    const disclaimer = page.getByTestId("disclaimer");
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText("Not a medical device");
    await expect(disclaimer).toContainText("For general fitness feedback only");

    expect(pageErrors).toEqual([]);
  });

  test("renders the camera stage with video and canvas overlay elements", async ({ page }) => {
    await page.goto("/");

    // Camera stage container
    const cameraStage = page.locator(".camera-stage");
    await expect(cameraStage).toBeVisible();

    // Video element attributes
    const video = page.locator("video.camera-video");
    await expect(video).toBeAttached();
    await expect(video).toHaveAttribute("playsinline", "");

    // Canvas overlay element
    const canvas = page.locator("canvas.camera-overlay");
    await expect(canvas).toBeAttached();

    // Status indicator exists
    const status = page.getByTestId("camera-status");
    await expect(status).toBeVisible();
  });
});
