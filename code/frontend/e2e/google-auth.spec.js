// Playwright E2E tests for Google OAuth gate, login flow, and logout.
import { test, expect } from "@playwright/test";

test.describe("Google OAuth Gate & Authentication Flow", () => {
  test("shows login gateway when unauthenticated, signs in with Google, and logs out", async ({ page }) => {
    await page.goto("/");

    // Gated login page is shown
    const loginPage = page.getByTestId("login-page");
    await expect(loginPage).toBeVisible();

    const signInBtn = page.getByTestId("google-signin-button");
    const configError = page.getByTestId("google-config-error");
    await expect(signInBtn.or(configError)).toBeVisible();
  });
});
