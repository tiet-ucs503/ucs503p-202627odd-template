import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

test('Security Headers and Strict CSP enforcement', async () => {
  const res = await fetch(`${BASE_URL}/api/health/live`);
  assert.strictEqual(res.status, 200);

  const csp = res.headers.get('content-security-policy') || '';
  assert.ok(csp.length > 0, 'CSP header must be present');
  const connectSrc = csp.split(';').find(directive => directive.trim().startsWith('connect-src')) || '';
  assert.ok(connectSrc.includes("'self'"), 'Same-origin API access must be allowed');
  assert.ok(!connectSrc.split(/\s+/).some(source => source === 'https:' || source === 'wss:'), 'Unrestricted HTTPS and WebSocket sources must not be allowed');
  if (process.env.SUPABASE_URL) {
    assert.ok(connectSrc.includes(new URL(process.env.SUPABASE_URL).origin), 'Only the configured Supabase origin should be allowed');
  }
});

test('Cookie-only session: login and demo-login do not expose token in JSON body', async () => {
  const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ roleKey: 'Student' }),
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.token, undefined, 'Login response must not return token in JSON body');

  // Verify cookie is set
  const setCookie = res.headers.get('set-cookie') || '';
  assert.ok(setCookie.includes('intellischedule_session='), 'HttpOnly intellischedule_session cookie must be set');
  assert.ok(setCookie.includes('HttpOnly') || setCookie.includes('httponly'), 'Cookie must be HttpOnly');
});

test('CSRF protection: state-changing request with forbidden origin is rejected with 403', async () => {
  const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://malicious-attacker.evil.com',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ roleKey: 'Student' }),
  });

  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.strictEqual(data.error, 'CSRF_ORIGIN_DENIED');
});
