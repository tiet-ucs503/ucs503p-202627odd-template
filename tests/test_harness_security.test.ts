import test from 'node:test';
import assert from 'node:assert';
import { isTestTokenAllowed } from '../src/server/testMode';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

test('ALLOW_TEST_RESET_TOKEN test harness security and production isolation', async () => {
  const email = 'coordinator.demo@demo.thapar.local';

  const resNoTest = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert.strictEqual(resNoTest.status, 200);
  const dataNoTest = await resNoTest.json();
  assert.strictEqual(dataNoTest.resetToken, undefined, 'No header gives no token even when flag is set');

  const resWithTest = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
    body: JSON.stringify({ email }),
  });
  assert.strictEqual(resWithTest.status, 200);
  const dataWithTest = await resWithTest.json();
  assert.ok(dataWithTest.resetToken, 'Flag set + header + test env gives a token');

  const savedNodeEnv = process.env.NODE_ENV;
  const savedFlag = process.env.ALLOW_TEST_RESET_TOKEN;
  try {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_RESET_TOKEN = 'true';
    const mockReq = { headers: { 'x-test-mode': 'true' } } as any;
    assert.strictEqual(isTestTokenAllowed(mockReq), false);
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
    process.env.ALLOW_TEST_RESET_TOKEN = savedFlag;
  }
});
