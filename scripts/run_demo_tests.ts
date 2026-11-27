/**
 * Automated Test Suite for Public Demo Accounts & Testing Flow
 * Verifies demo authentication, RBAC boundaries, bcrypt password verification,
 * timetable generation with demo dataset, and demo reset mechanics.
 */

import http from 'node:http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
}

function request(
  method: string,
  path: string,
  data?: any,
  cookie?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers: Record<string, string | number> = {
      Accept: 'application/json',
    };

    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request(
      `${BASE_URL}${path}`,
      { method, headers },
      (res) => {
        let rawBody = '';
        res.on('data', (chunk) => {
          rawBody += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawBody);
          } catch {
            parsed = rawBody;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (data) {
      req.write(postData);
    }
    req.end();
  });
}

/** Sessions are HttpOnly cookies; extract the "name=value" pair from a login response. */
function sessionCookieFrom(res: HttpResponse): string {
  const raw = res.headers['set-cookie'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return (first || '').split(';')[0] || '';
}

let failureCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    failureCount++;
    process.exitCode = 1;
  } else {
    console.log(`  ✓ [PASS] ${message}`);
  }
}

async function runDemoAudit() {
  console.log('================================================================');
  console.log('INTELLISCHEDULE PUBLIC DEMO AUDIT SUITE');
  console.log('================================================================\n');

  // 1. Check Demo Status API
  console.log('--- 1. Testing Demo Configuration & Status API ---');
  const statusRes = await request('GET', '/api/demo/status');
  assert(statusRes.status === 200, 'GET /api/demo/status returns HTTP 200');
  assert(statusRes.body?.enabled === true, 'Public demo mode is active');
  assert(Array.isArray(statusRes.body?.accounts) && statusRes.body.accounts.length === 5, 'Status reports exactly 5 supported demo accounts');

  // 2. Demo One-Click Authentication for all 5 roles
  console.log('\n--- 2. Testing One-Click Demo Role Authentication ---');
  const roles = [
    { key: 'Coordinator', expectedCode: 'COORDINATOR', email: 'coordinator.demo@demo.thapar.local' },
    { key: 'Faculty', expectedCode: 'FACULTY', email: 'faculty.demo@demo.thapar.local' },
    { key: 'Student', expectedCode: 'STUDENT', email: 'student.demo@demo.thapar.local' },
    { key: 'Admin', expectedCode: 'COLLEGE_ADMIN', email: 'admin.demo@demo.thapar.local' },
    { key: 'HOD', expectedCode: 'HOD', email: 'hod.demo@demo.thapar.local' },
  ];

  const sessionTokens: Record<string, string> = {};

  for (const r of roles) {
    const demoRes = await request('POST', '/api/auth/demo-login', { roleKey: r.key });
    assert(demoRes.status === 200, `Demo login for ${r.key} returns HTTP 200`);
    assert(demoRes.body?.success === true, `Demo login for ${r.key} succeeded`);
    assert(demoRes.body?.roleCode === r.expectedCode, `Server-authoritative roleCode is ${r.expectedCode}`);
    assert(demoRes.body?.user?.email === r.email, `Demo identity is ${r.email}`);
    assert(demoRes.body?.user?.isDemoUser === true, `User is explicitly flagged as isDemoUser=true`);
    assert(demoRes.body?.token === undefined, `Session token is not exposed in the JSON body for ${r.key}`);
    sessionTokens[r.key] = sessionCookieFrom(demoRes);
    assert(sessionTokens[r.key].startsWith('intellischedule_session='), `HttpOnly session cookie issued for ${r.key}`);
  }

  // 3. Bcrypt Password Verification with Configured Demo Password
  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!demoPassword) {
    throw new Error('DEMO_ACCOUNT_PASSWORD must be set when running demo tests.');
  }
  console.log('\n--- 3. Testing Standard Credentials Login ---');
  const standardLoginRes = await request('POST', '/api/auth/login', {
    email: 'coordinator.demo@demo.thapar.local',
    password: demoPassword,
  });
  assert(standardLoginRes.status === 200, 'Coordinator demo logs in with demo password via /api/auth/login');
  assert(standardLoginRes.body?.user?.isDemoUser === true, 'Returned user object maintains isDemoUser=true');

  const wrongPassRes = await request('POST', '/api/auth/login', {
    email: 'coordinator.demo@demo.thapar.local',
    password: 'IncorrectPassword123!',
  });
  assert(wrongPassRes.status === 401, 'Incorrect password correctly rejected with HTTP 401');

  // 4. Session Verification & Logout
  console.log('\n--- 4. Testing Session Verification & Revocation ---');
  const coordToken = sessionTokens['Coordinator'];
  const meRes = await request('GET', '/api/auth/me', null, coordToken);
  assert(meRes.status === 200, '/api/auth/me accepts demo session cookie and returns profile');
  assert(meRes.body?.user?.email === 'coordinator.demo@demo.thapar.local', 'Profile email matches coordinator demo');

  const logoutRes = await request('POST', '/api/auth/logout', null, coordToken);
  assert(logoutRes.status === 200, '/api/auth/logout succeeds');

  const revokedMeRes = await request('GET', '/api/auth/me', null, coordToken);
  assert(revokedMeRes.status === 401, 'Revoked demo token rejected on /api/auth/me with HTTP 401');

  // 5. RBAC & Privilege Enforcement
  console.log('\n--- 5. Testing Role Isolation & RBAC Boundaries ---');
  const studentToken = sessionTokens['Student'];
  const facultyToken = sessionTokens['Faculty'];
  const adminToken = sessionTokens['Admin'];

  // Student trying to generate timetable -> MUST BE FORBIDDEN
  const studentGenerate = await request('POST', '/api/timetables/generate', {}, studentToken);
  assert(studentGenerate.status === 403, 'Student blocked from timetable generation with HTTP 403 (FORBIDDEN)');

  // Faculty trying to publish timetable -> MUST BE FORBIDDEN
  const facultyPublish = await request('POST', '/api/timetables/publish', {}, facultyToken);
  assert(facultyPublish.status === 403, 'Faculty blocked from timetable publishing with HTTP 403 (FORBIDDEN)');

  // 6. Timetable Generator Execution on Demo Dataset
  console.log('\n--- 6. Testing Timetable Engine on Demo Dataset ---');
  // Re-login coordinator for generation test
  const freshCoordLogin = await request('POST', '/api/auth/demo-login', { roleKey: 'Coordinator' });
  const freshCoordToken = sessionCookieFrom(freshCoordLogin);

  const generateRes = await request('POST', '/api/timetables/generate', {}, freshCoordToken);
  assert(generateRes.status === 200, 'Coordinator triggers /api/timetables/generate successfully');
  assert(generateRes.body?.success === true || generateRes.body?.isFeasible === true, 'Timetable generation returns success=true');
  const sessionCount = generateRes.body?.sessionsGenerated || generateRes.body?.bestCandidate?.sessions?.length || 0;
  assert(sessionCount > 0, `Engine generated ${sessionCount} valid class sessions`);

  // The generated draft is now feasible, so an Admin publish should succeed.
  const adminPublishValid = await request('POST', '/api/timetables/publish', {}, adminToken);
  assert(adminPublishValid.status === 200, `Admin publishes the generated master timetable (HTTP ${adminPublishValid.status})`);

  // 7. Safe Demo Data Reset
  console.log('\n--- 7. Testing Safe Demo Data Reset ---');
  const resetRes = await request('POST', '/api/demo/reset', {}, freshCoordToken);
  assert(resetRes.status === 200, '/api/demo/reset succeeds with HTTP 200');
  assert(resetRes.body?.success === true, 'Demo reset response confirms restoration to baseline');

  // Verify that Demo password is intact after reset
  const afterResetLogin = await request('POST', '/api/auth/login', {
    email: 'coordinator.demo@demo.thapar.local',
    password: demoPassword,
  });
  assert(afterResetLogin.status === 200, 'Coordinator demo can log in with demo password after dataset reset');

  console.log('\n================================================================');
  console.log(failureCount === 0 ? 'DEMO AUDIT RESULT: ALL TESTS PASSED' : `DEMO AUDIT RESULT: ${failureCount} TEST(S) FAILED`);
  console.log('================================================================\n');
}

runDemoAudit().catch((err) => {
  console.error('Fatal demo test runner failure:', err);
  process.exit(1);
});
