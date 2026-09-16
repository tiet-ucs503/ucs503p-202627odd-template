import { test, expect } from "@playwright/test";
import { authenticatePage } from "./test-helpers.js";

test.describe("Camera Permission & Device Fallbacks", () => {
  test.beforeEach(async ({ page }) => {
    await authenticatePage(page);
  });
  test("displays 'Status: denied' when camera access is rejected by the user", async ({ page }) => {
    // Inject mock before page load to reject getUserMedia with NotAllowedError
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("Permission denied by user", "NotAllowedError"));
    });

    await page.goto("/");

    const status = page.getByTestId("camera-status");
    await expect(status).toHaveText("Status: denied");

    // Readout should NOT be visible when denied
    const readout = page.getByTestId("knee-angle-readout");
    await expect(readout).not.toBeVisible();
  });

  test("displays 'Status: no-device' when no camera hardware is found", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("Requested device not found", "NotFoundError"));
    });

    await page.goto("/");

    const status = page.getByTestId("camera-status");
    await expect(status).toHaveText("Status: no-device");

    const readout = page.getByTestId("knee-angle-readout");
    await expect(readout).not.toBeVisible();
  });

  test("displays 'Status: no-device' when navigator.mediaDevices is undefined", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        configurable: true,
      });
    });

    await page.goto("/");

    const status = page.getByTestId("camera-status");
    await expect(status).toHaveText("Status: no-device");
  });
});
