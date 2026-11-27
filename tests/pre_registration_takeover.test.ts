import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

test('Duplicate pending registration cannot replace the requested account password', async () => {
  const victimEmail = `victim.${Date.now()}@thapar.edu`;
  const attackerPwd = 'AttackerPassword123!';
  const victimPwd = 'VictimPassword123!';

  // 1. Attacker registers victim's address with attackerPwd
  const reg1Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
    body: JSON.stringify({
      email: victimEmail,
      password: attackerPwd,
      name: 'Attacker Attempt',
      roleCode: 'STUDENT',
      department: 'CSED',
    }),
  });
  assert.strictEqual(reg1Res.status, 202);

  // 2. A second registration must not replace the first account's credentials.
  const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
    body: JSON.stringify({
      email: victimEmail,
      password: victimPwd,
      name: 'Real Victim',
      roleCode: 'STUDENT',
      department: 'CSED',
    }),
  });
  assert.strictEqual(reg2Res.status, 202);
  const reg2Data = await reg2Res.json();
  assert.strictEqual(reg2Data.verificationToken, undefined);
  assert.strictEqual(reg2Data.status, 'PENDING');

  // 3. The original password remains associated with the pending request.
  const loginAttacker = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: victimEmail, password: attackerPwd }),
  });
  assert.strictEqual(loginAttacker.status, 403);
  assert.strictEqual((await loginAttacker.json()).error, 'ACCOUNT_PENDING_APPROVAL');

  // 4. The second password cannot replace the first one; invalid credentials remain denied.
  const loginSecondRegistration = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: victimEmail, password: victimPwd }),
  });
  assert.strictEqual(loginSecondRegistration.status, 401);
});
