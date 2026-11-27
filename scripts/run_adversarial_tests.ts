import { performance } from 'perf_hooks';

interface AdversarialTestResult {
  category: string;
  name: string;
  passed: boolean;
  httpStatus: number;
  expectedStatus: number;
  details?: string;
}

const testResults: AdversarialTestResult[] = [];

function recordTest(passed: boolean, category: string, name: string, httpStatus: number, expectedStatus: number, details?: string) {
  testResults.push({ category, name, passed, httpStatus, expectedStatus, details });
  if (passed) {
    const outcome = expectedStatus === 401 || expectedStatus === 403 ? 'BLOCKED / VERIFIED' : 'VERIFIED';
    console.log(`  ✓ [${outcome}] [${category}] ${name} -> HTTP ${httpStatus} (Expected: ${expectedStatus})`);
  } else {
    console.error(`  ✗ [VULNERABILITY / FAILED] [${category}] ${name} -> HTTP ${httpStatus} (Expected: ${expectedStatus}) - ${details}`);
  }
}

/** Session is delivered as an HttpOnly cookie; return the "name=value" pair for use in a Cookie request header. */
function sessionCookieFrom(res: Response): string {
  return (res.headers.get('set-cookie') || '').split(';')[0] || '';
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('INTELLISCHEDULE ADVERSARIAL RED-TEAM VERIFICATION SUITE');
  console.log('================================================================\n');

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  // -------------------------------------------------------------
  // SETUP: Authenticate distinct personas
  // -------------------------------------------------------------
  console.log('--- Phase 0: Authenticating Personas for Adversarial Testing ---');
  const seedPassword = process.env.SEED_USER_PASSWORD;
  if (!seedPassword) {
    throw new Error('SEED_USER_PASSWORD must be set when running adversarial tests.');
  }
  
  // Student: Aarav Mehta
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.m@thapar.edu', password: seedPassword }),
  });
  const studentData = await studentLoginRes.json();
  const studentCookie = sessionCookieFrom(studentLoginRes);

  // Faculty: Prof. Arvind Sharma
  const facultyLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a.sharma@thapar.edu', password: seedPassword }),
  });
  const facultyData = await facultyLoginRes.json();
  const facultyCookie = sessionCookieFrom(facultyLoginRes);

  // Coordinator: Dr. K. N. Murthy
  const coordLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kn.murthy@thapar.edu', password: seedPassword }),
  });
  const coordData = await coordLoginRes.json();
  const coordCookie = sessionCookieFrom(coordLoginRes);

  // Admin / Dean: Dr. Vikram Sengupta
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dean@thapar.edu', password: seedPassword }),
  });
  const adminData = await adminLoginRes.json();
  const adminCookie = sessionCookieFrom(adminLoginRes);

  console.log(`  ✓ Personas Authenticated: Student, Faculty, Coordinator, Admin.\n`);

  // -------------------------------------------------------------
  // ATTACK VECTOR 1: UNAUTHENTICATED DIRECT ACCESS (Layer 4 & 5)
  // -------------------------------------------------------------
  console.log('--- 1. Attack Vector: Unauthenticated Direct API Requests ---');

  // 1.1 Unauthenticated Timetable Generation
  const unauthGen = await fetch(`${BASE_URL}/api/timetable/generate`, { method: 'POST' });
  recordTest(unauthGen.status === 401, 'Unauthenticated', 'Direct timetable generation without token', unauthGen.status, 401);

  // 1.2 Unauthenticated Timetable Publish
  const unauthPub = await fetch(`${BASE_URL}/api/timetable/publish`, { method: 'POST' });
  recordTest(unauthPub.status === 401, 'Unauthenticated', 'Direct timetable publish without token', unauthPub.status, 401);

  // 1.3 Unauthenticated Course Creation
  const unauthCourse = await fetch(`${BASE_URL}/api/academic/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'HACK101', title: 'Exploit Course', credits: 4 }),
  });
  recordTest(unauthCourse.status === 401, 'Unauthenticated', 'Direct course creation without token', unauthCourse.status, 401);

  // -------------------------------------------------------------
  // ATTACK VECTOR 2: FORGED & TAMPERED SESSION TOKENS (Layer 4)
  // -------------------------------------------------------------
  console.log('\n--- 2. Attack Vector: Manipulated & Forged Session Tokens ---');

  // 2.1 Forged random token
  const forgedRes = await fetch(`${BASE_URL}/api/timetable/generate`, {
    method: 'POST',
    headers: { Authorization: 'Bearer jwt_live_forged_random_attacker_token_9999' },
  });
  recordTest(forgedRes.status === 401, 'Token Forgery', 'Forged random bearer token', forgedRes.status, 401);

  // 2.2 Malformed token prefix
  const malformedRes = await fetch(`${BASE_URL}/api/timetable/generate`, {
    method: 'POST',
    headers: { Authorization: 'Bearer malformed_token_structure' },
  });
  recordTest(malformedRes.status === 401, 'Token Forgery', 'Malformed token string', malformedRes.status, 401);

  // -------------------------------------------------------------
  // ATTACK VECTOR 3: PRIVILEGE ESCALATION (VERTICAL RBAC) (Layer 4)
  // -------------------------------------------------------------
  console.log('\n--- 3. Attack Vector: Privilege Escalation & Cross-Role Access ---');

  // 3.1 Student attempting Timetable Generation
  const studentGen = await fetch(`${BASE_URL}/api/timetable/generate`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
  });
  recordTest(studentGen.status === 403, 'Privilege Escalation', 'Student attempting master timetable generation', studentGen.status, 403);

  // 3.2 Student attempting Master Timetable Publish
  const studentPub = await fetch(`${BASE_URL}/api/timetable/publish`, {
    method: 'POST',
    headers: { Cookie: studentCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId: 'V1.0' }),
  });
  recordTest(studentPub.status === 403, 'Privilege Escalation', 'Student attempting master timetable publishing', studentPub.status, 403);

  // 3.3 Student attempting Department Creation
  const studentDept = await fetch(`${BASE_URL}/api/academic/departments`, {
    method: 'POST',
    headers: { Cookie: studentCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Malicious Department', code: 'MAL_DEPT' }),
  });
  recordTest(studentDept.status === 403, 'Privilege Escalation', 'Student attempting department creation', studentDept.status, 403);

  // 3.4 Student attempting Course Allocation
  const studentAlloc = await fetch(`${BASE_URL}/api/academic/allocations`, {
    method: 'POST',
    headers: { Cookie: studentCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId: 'CS501', facultyId: 'fac-sharma', sectionId: 'sec-cse-a' }),
  });
  recordTest(studentAlloc.status === 403, 'Privilege Escalation', 'Student attempting course allocation modification', studentAlloc.status, 403);

  // 3.5 Faculty attempting Timetable Publish (Coordinator/Dean only)
  const facultyPub = await fetch(`${BASE_URL}/api/timetable/publish`, {
    method: 'POST',
    headers: { Cookie: facultyCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId: 'V1.0' }),
  });
  recordTest(facultyPub.status === 403, 'Privilege Escalation', 'Faculty attempting timetable publishing', facultyPub.status, 403);

  // Coordinators are explicitly allowed to publish by docs/permissions.md.
  const coordPub = await fetch(`${BASE_URL}/api/timetable/publish`, {
    method: 'POST',
    headers: { Cookie: coordCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId: 'V1.0' }),
  });
  recordTest(coordPub.status === 200, 'RBAC Contract', 'Coordinator publishing is allowed by the documented permissions matrix', coordPub.status, 200);

  // -------------------------------------------------------------
  // ATTACK VECTOR 4: CLIENT PAYLOAD ROLE INJECTION & MANIPULATION
  // -------------------------------------------------------------
  console.log('\n--- 4. Attack Vector: Client Payload Role Injection ---');

  // 4.1 Registration attempting to inject COLLEGE_ADMIN role
  const injectedRegEmail = `injected_${Date.now()}@thapar.edu`;
  const injectReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
    body: JSON.stringify({
      name: 'Adversary User',
      email: injectedRegEmail,
      password: 'AttackerPassword2026!',
      role: 'COLLEGE_ADMIN',
      roleCode: 'STUDENT',
      roleName: 'Dean of Academic Affairs',
      authorizedWorkspaces: ['Admin', 'Coordinator'],
    }),
  });
  const injectData = await injectReg.json();
  // The only supported signup role is STUDENT/FACULTY/COORDINATOR. Extra client fields are ignored.
  recordTest(
    injectReg.status === 202 && injectData.success === true && injectData.status === 'PENDING' && injectData.roleCode === 'STUDENT' && !injectData.token,
    'Role Injection',
    'Registration queues the requested STUDENT role and ignores injected admin fields',
    injectReg.status,
    202
  );

  // Admin approval activates the requested role; the client-supplied role/workspaces stay untrusted.
  const approvalRes = await fetch(`${BASE_URL}/api/admin/pending-registrations/${encodeURIComponent(injectedRegEmail)}/approve`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleCode: 'STUDENT' }),
  });
  const approvalData = await approvalRes.json();
  recordTest(approvalRes.status === 200 && approvalData.user?.roleCode === 'STUDENT', 'Role Injection', 'Admin approval activates only the approved STUDENT role', approvalRes.status, 200);

  const injectLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: injectedRegEmail, password: 'AttackerPassword2026!' }),
  });
  const injectLoginData = await injectLoginRes.json();
  const injectedCookie = sessionCookieFrom(injectLoginRes);
  
  const injectAdminAccess = await fetch(`${BASE_URL}/api/timetable/publish`, {
    method: 'POST',
    headers: { Cookie: injectedCookie },
  });
  recordTest(
    injectLoginData.roleCode === 'STUDENT' && injectAdminAccess.status === 403,
    'Role Injection',
    'Injected account blocked from admin endpoints and enforced as STUDENT role',
    injectAdminAccess.status,
    403
  );

  // -------------------------------------------------------------
  // ATTACK VECTOR 5: OAUTH CSRF STATE TAMPERING (Layer 10)
  // -------------------------------------------------------------
  console.log('\n--- 5. Attack Vector: OAuth 2.0 State Tampering ---');

  // 5.1 Fabricated state token in callback (API client requesting JSON)
  const fakeStateJson = await fetch(`${BASE_URL}/api/auth/google/callback?code=mock_code&state=forged_unregistered_state_9999`, {
    headers: { Accept: 'application/json' },
  });
  recordTest(
    fakeStateJson.status === 400,
    'OAuth Security',
    'JSON API rejection of forged / unissued OAuth CSRF state (HTTP 400)',
    fakeStateJson.status,
    400
  );

  // 5.2 Fabricated state token in callback (Browser navigation redirect)
  const fakeStateRedirect = await fetch(`${BASE_URL}/api/auth/google/callback?code=mock_code&state=forged_unregistered_state_9999`, {
    redirect: 'manual',
  });
  recordTest(
    fakeStateRedirect.status === 302,
    'OAuth Security',
    'Browser redirect to /?auth_error on invalid OAuth CSRF state (HTTP 302)',
    fakeStateRedirect.status,
    302
  );

  // -------------------------------------------------------------
  // ATTACK VECTOR 6: PASSWORD RESET TOKEN ABUSE & REPLAY
  // -------------------------------------------------------------
  console.log('\n--- 6. Attack Vector: Password Reset Token Abuse & Replay ---');

  // Step A: Request valid reset & verify no token leak
  const resetReq = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: injectedRegEmail }),
  });
  const resetReqData = await resetReq.json();
  const resetToken = resetReqData.resetToken;
  recordTest(resetReq.status === 200 && resetToken === undefined, 'Password Reset', 'Reset token is not leaked in response body', resetReq.status, 200);

  // Step B: Forged token rejected
  const forgedReset = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'forged_fake_token_12345', newPassword: 'AttackerOverridingPassword!' }),
  });
  recordTest(forgedReset.status === 400, 'Password Reset', 'Forged / invalid token rejected on reset', forgedReset.status, 400);

  // -------------------------------------------------------------
  // POSITIVE CONTROL: VERIFY AUTHORIZED OPERATIONS SUCCEED
  // -------------------------------------------------------------
  console.log('\n--- 7. Positive Verification: Authorized Operations Succeed ---');

  // 7.1 Coordinator generates timetable
  const coordGen = await fetch(`${BASE_URL}/api/timetable/generate`, {
    method: 'POST',
    headers: { Cookie: coordCookie },
  });
  const coordGenData = await coordGen.json();
  recordTest(coordGen.status === 200, 'Authorized Role', 'Coordinator successfully generates draft timetable', coordGen.status, 200);

  // 7.2 Admin / Dean approves and publishes timetable
  const adminPub = await fetch(`${BASE_URL}/api/timetable/publish`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId: 'V1.0' }),
  });
  recordTest(adminPub.status === 200, 'Authorized Role', 'Admin / Dean successfully publishes master timetable', adminPub.status, 200);

  // 7.3 Faculty cancels class session for recovery
  // Fetch active session from bootstrap to guarantee valid session ID
  const bootstrapRes = await fetch(`${BASE_URL}/api/academic/bootstrap`, {
    headers: { Cookie: facultyCookie },
  });
  const bootstrapData = await bootstrapRes.json();
  const facultyProfile = (bootstrapData.facultyMembers || []).find(
    (f: any) => String(f.email || '').toLowerCase() === 'a.sharma@thapar.edu'
  );
  const generatedSessionList = (coordGenData.routines || []).flatMap((r: any) => Array.isArray(r.sessions) ? r.sessions : []);
  const versionsRes = await fetch(`${BASE_URL}/api/timetable/versions`, {
    headers: { Cookie: facultyCookie },
  });
  const versionsData = await versionsRes.json();
  const versionList = versionsData.versions || [];
  const persistedSessionList = versionList.flatMap((v: any) => Array.isArray(v.sessions) ? v.sessions : []);
  const sessionList = generatedSessionList.length > 0 ? generatedSessionList : persistedSessionList;
  const sessionToCancel = sessionList.find(
    (s: any) => s.status !== 'Cancelled' && facultyProfile && s.facultyId === facultyProfile.id
  )?.id;

  const facultyCancel = await fetch(`${BASE_URL}/api/recovery/cancel-class`, {
    method: 'POST',
    headers: { Cookie: facultyCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionToCancel, reason: 'Conference Attendance' }),
  });
  recordTest(facultyCancel.status === 200, 'Authorized Role', 'Faculty successfully initiates class cancellation', facultyCancel.status, 200);

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  const total = testResults.length;
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  console.log(`ADVERSARIAL TESTS TOTAL: ${total} | BLOCKED / PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Adversarial runner fatal error:', err);
  process.exit(1);
});
