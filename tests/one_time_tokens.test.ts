import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

test('Registration awaits admin approval and password-reset tokens stay private', async () => {
  const email = `token.test.${Date.now()}@thapar.edu`;
  const password = 'Password123!';

  // 1. Registration creates a pending request and never returns a verification token.
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
    body: JSON.stringify({
      email,
      password,
      name: 'Token Test User',
      roleCode: 'STUDENT',
      department: 'CSED',
    }),
  });
  assert.strictEqual(regRes.status, 202);
  const regData = await regRes.json();
  assert.strictEqual(regData.status, 'PENDING');
  assert.strictEqual(regData.user, undefined);
  assert.strictEqual(regData.verificationToken, undefined);

  // 2. Pending accounts cannot access a portal until an administrator approves them.
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.strictEqual(loginRes.status, 403);
  assert.strictEqual((await loginRes.json()).error, 'ACCOUNT_PENDING_APPROVAL');

  // 3. The retired verification endpoint cannot activate a pending account.
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
    body: JSON.stringify({ token: '' }),
  });
  assert.strictEqual(verifyRes.status, 410);

  // 5. Request password reset -> receives reset token
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
    body: JSON.stringify({ email: 'coordinator.demo@demo.thapar.local' }),
  });
  assert.strictEqual(forgotRes.status, 200);
  const forgotData = await forgotRes.json();
  const resetToken = forgotData.resetToken;
  assert.ok(resetToken, 'Reset token expected in test mode');

  assert.strictEqual(forgotData.verificationToken, undefined);
});
