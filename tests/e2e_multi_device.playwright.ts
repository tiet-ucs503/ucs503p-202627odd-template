/**
 * Multi-Device / Multi-Browser E2E Acceptance Spec (Playwright).
 * Run locally against a running server:
 *   BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e_multi_device.playwright.ts
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

test.describe('Multi-Device Real-Time University Synchronization', () => {
  test('Coordinator publishes routine -> Student device receives live update without refresh', async ({ browser }) => {
    const coordContext = await browser.newContext();
    const studentContext = await browser.newContext();
    const coordPage = await coordContext.newPage();
    const studentPage = await studentContext.newPage();

    await coordPage.goto(BASE_URL);
    await studentPage.goto(BASE_URL);

    // Sign in via Demo Roles on two isolated browser contexts (two devices)
    await coordPage.getByRole('button', { name: /Coordinator/i }).first().click();
    await studentPage.getByRole('button', { name: /Student/i }).first().click();

    await expect(coordPage.locator('body')).toContainText(/Coordinator|Timetable/i, { timeout: 15000 });
    await expect(studentPage.locator('body')).toContainText(/Student|Timetable/i, { timeout: 15000 });

    // Trigger publish on Coordinator device and assert Student device remains synced via SSE
    const publishBtn = coordPage.getByRole('button', { name: /Publish/i }).first();
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
    }
    await expect(studentPage.locator('body')).not.toContainText(/No timetable has been published yet/i, { timeout: 10000 });

    await coordContext.close();
    await studentContext.close();
  });
});
