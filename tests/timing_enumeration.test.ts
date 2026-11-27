import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function measureRequests(url: string, body: Record<string, any>, count: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    // Keep the endpoint's per-IP rate limiter from turning most samples into fast 429s.
    // This helper is only mounted by the non-production test server.
    await fetch(`${BASE_URL}/api/test/reset-rate-limits`, { method: 'POST' });
    const start = performance.now();
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
      body: JSON.stringify(body),
    });
    times.push(performance.now() - start);
  }
  return times;
}

function mean(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

test('Timing side-channel mitigation for anti-enumeration endpoints', async () => {
  const existingEmail = 'coordinator.demo@demo.thapar.local';
  const nonExistingEmail = `nonexistent.${Date.now()}@thapar.edu`;

  // Measure 30 requests for existing account vs non-existing account on /api/auth/forgot-password
  const forgotExisting = await measureRequests(`${BASE_URL}/api/auth/forgot-password`, { email: existingEmail }, 30);
  const forgotNonExisting = await measureRequests(`${BASE_URL}/api/auth/forgot-password`, { email: nonExistingEmail }, 30);

  const meanForgotExisting = mean(forgotExisting);
  const meanForgotNonExisting = mean(forgotNonExisting);
  const diffForgot = Math.abs(meanForgotExisting - meanForgotNonExisting);

  console.log(`[TIMING TEST] forgot-password mean existing: ${meanForgotExisting.toFixed(2)}ms, non-existing: ${meanForgotNonExisting.toFixed(2)}ms, diff: ${diffForgot.toFixed(2)}ms`);
  assert.ok(diffForgot < 15, `Mean timing difference for forgot-password (${diffForgot.toFixed(2)}ms) should be < 15ms`);

  // Measure 30 requests for resend-verification
  const resendExisting = await measureRequests(`${BASE_URL}/api/auth/resend-verification`, { email: existingEmail }, 30);
  const resendNonExisting = await measureRequests(`${BASE_URL}/api/auth/resend-verification`, { email: nonExistingEmail }, 30);

  const meanResendExisting = mean(resendExisting);
  const meanResendNonExisting = mean(resendNonExisting);
  const diffResend = Math.abs(meanResendExisting - meanResendNonExisting);

  console.log(`[TIMING TEST] resend-verification mean existing: ${meanResendExisting.toFixed(2)}ms, non-existing: ${meanResendNonExisting.toFixed(2)}ms, diff: ${diffResend.toFixed(2)}ms`);
  assert.ok(diffResend < 15, `Mean timing difference for resend-verification (${diffResend.toFixed(2)}ms) should be < 15ms`);
});
