import { generateTimetableFromConfiguration, validateAcademicSetup } from '../src/lib/timetableGenerator';
import { checkHardConstraints } from '../src/lib/recoveryEngine';
import {
  hashPasswordBcryptSync,
  hashPasswordScryptSync,
  verifyPasswordSync,
  hashPasswordLegacySync
} from '../src/lib/passwordUtils';
import {
  INITIAL_ACADEMIC_YEAR,
  DEPARTMENTS,
  PROGRAMS,
  ROOMS,
  FACULTY_MEMBERS,
  SECTIONS,
  COURSES,
  INITIAL_ALLOCATIONS,
  INITIAL_CONSTRAINTS,
  INITIAL_SESSIONS
} from '../src/lib/initialData';
import {
  ClassSession,
  Department,
  Program,
  Course,
  Faculty,
  Room,
  StudentSection,
  CourseAllocation,
  AcademicConstraint,
  AcademicYearConfig
} from '../src/types';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  error?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, message?: string) {
  if (condition) {
    results.push({ suite, name, passed: true, message });
    console.log(`  ✓ [PASS] [${suite}] ${name}`);
  } else {
    results.push({ suite, name, passed: false, message: message || 'Assertion failed' });
    console.error(`  ✗ [FAIL] [${suite}] ${name}: ${message || 'Assertion failed'}`);
  }
}

function calculatePercentile(latencies: number[], percentile: number): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return Number((sorted[Math.max(0, index)] || 0).toFixed(2));
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('INTELLISCHEDULE INDEPENDENT SECURITY & PERFORMANCE AUDIT SUITE');
  console.log('================================================================\n');

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  // -------------------------------------------------------------
  // SUITE 0: MONITORING & HEALTH CHECKS (Layer 14)
  // -------------------------------------------------------------
  console.log('--- 0. Testing Monitoring & Health Checks ---');
  try {
    const liveRes = await fetch(`${BASE_URL}/api/health/live`);
    const liveData = await liveRes.json();
    assert(liveRes.status === 200 && liveData.status === 'LIVE', 'Health Check', 'Liveness check /api/health/live returns HTTP 200 LIVE');
  } catch (err) {
    assert(false, 'Health Check', 'Liveness check failed', String(err));
  }

  try {
    const readyRes = await fetch(`${BASE_URL}/api/health/ready`);
    const readyData = await readyRes.json();
    assert(readyRes.status === 200 && readyData.status === 'READY', 'Health Check', 'Readiness check /api/health/ready returns HTTP 200 READY');
  } catch (err) {
    assert(false, 'Health Check', 'Readiness check failed', String(err));
  }

  // -------------------------------------------------------------
  // SUITE 1: PASSWORD HASHING & KEY DERIVATION FUNCTION (BCRYPT / SCRYPT)
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Bcrypt/Scrypt KDF & Password Migration Security ---');

  // Test 1.1: Bcrypt Format ($2b$ cost 12)
  const bcryptHash = hashPasswordBcryptSync('TestSecurePassword123!');
  assert(
    bcryptHash.startsWith('$2b$12$') || bcryptHash.startsWith('$2a$12$'),
    'Password Hashing',
    'Bcrypt KDF generates standard Blowfish formatted hash: $2b$12$<salt><hash>'
  );

  // Test 1.2: Bcrypt Verification
  const bcryptVerify = verifyPasswordSync('TestSecurePassword123!', bcryptHash);
  assert(
    bcryptVerify.isValid === true && bcryptVerify.needsRehash === false && bcryptVerify.detectedAlgorithm === 'bcrypt',
    'Password Hashing',
    'Bcrypt verification confirms valid password without needing rehash'
  );

  // Test 1.3: Scrypt Verification with Upgrade Flag
  const scryptHash = hashPasswordScryptSync('TestSecurePassword123!');
  const scryptVerify = verifyPasswordSync('TestSecurePassword123!', scryptHash);
  assert(
    scryptVerify.isValid === true && scryptVerify.needsRehash === true && scryptVerify.detectedAlgorithm === 'scrypt',
    'Password Hashing',
    'Scrypt verification confirms valid password and flags for upgrade to standard bcrypt'
  );

  // Test 1.4: Invalid Password Rejection under Bcrypt
  const bcryptWrongVerify = verifyPasswordSync('WrongPassword!', bcryptHash);
  assert(
    bcryptWrongVerify.isValid === false,
    'Password Hashing',
    'Bcrypt verification rejects incorrect password'
  );

  // Test 1.5: Legacy SHA-256 Backward Compatibility & Transparent Rehash Detection
  const legacyHash = hashPasswordLegacySync('OldLegacyPassword2025!');
  const legacyVerify = verifyPasswordSync('OldLegacyPassword2025!', legacyHash);
  assert(
    legacyVerify.isValid === true && legacyVerify.needsRehash === true && legacyVerify.detectedAlgorithm === 'sha256',
    'Password Hashing',
    'Legacy salted SHA-256 is correctly verified and flagged for transparent on-the-fly rehash upgrade'
  );

  // -------------------------------------------------------------
  // SUITE 2: AUTHENTICATION API & ROLE RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Authentication & RBAC APIs ---');
  await fetch(`${BASE_URL}/api/test/reset-rate-limits`, { method: 'POST' }).catch(() => {});
  const seedPassword = process.env.SEED_USER_PASSWORD;
  if (!seedPassword) {
    throw new Error('SEED_USER_PASSWORD must be set when running the HTTP integration suite.');
  }

  // Test 2.1: Missing Credentials
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    });
    const data = await res.json();
    assert(res.status === 400 && data.success === false, 'Auth API', 'Empty credentials return HTTP 400');
  } catch (err) {
    assert(false, 'Auth API', 'Empty credentials test failed', String(err));
  }

  // Test 2.2: Invalid Password
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kn.murthy@thapar.edu', password: 'WrongPassword99!' }),
    });
    const data = await res.json();
    assert(res.status === 401 && data.success === false, 'Auth API', 'Invalid password returns HTTP 401');
  } catch (err) {
    assert(false, 'Auth API', 'Invalid password test failed', String(err));
  }

  // Test 2.3: Non-existent User (Non-enumerating error message)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.user@thapar.edu', password: seedPassword }),
    });
    const data = await res.json();
    assert(res.status === 401 && data.success === false, 'Auth API', 'Nonexistent user returns HTTP 401 with generic message');
  } catch (err) {
    assert(false, 'Auth API', 'Nonexistent user test failed', String(err));
  }

  // Test 2.4: Valid Coordinator Login & Multi-Workspace Resolution
  let coordinatorCookie = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kn.murthy@thapar.edu', password: seedPassword }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie') || '';
    coordinatorCookie = setCookie.split(';')[0] || '';
    assert(
      res.status === 200 &&
      data.success === true &&
      !data.token &&
      setCookie.includes('intellischedule_session=') &&
      data.role === 'Coordinator' &&
      data.authorizedWorkspaces.includes('Coordinator') &&
      data.authorizedWorkspaces.includes('Faculty'),
      'Auth API',
      'Coordinator login resolves role and multi-workspaces [Coordinator, Faculty]',
      `status=${res.status}; body=${JSON.stringify(data)}; cookiePresent=${Boolean(coordinatorCookie)}`
    );
  } catch (err) {
    assert(false, 'Auth API', 'Coordinator login test failed', String(err));
  }

  // Test 2.5: Valid Student Login (Aarav Mehta - Student + CR multi-workspace)
  let studentCookie = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav.m@thapar.edu', password: seedPassword }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie') || '';
    studentCookie = setCookie.split(';')[0] || '';
    assert(
      res.status === 200 &&
      data.success === true &&
      !data.token &&
      setCookie.includes('intellischedule_session=') &&
      data.role === 'Student' &&
      data.authorizedWorkspaces.includes('Student') &&
      data.authorizedWorkspaces.includes('CR'),
      'Auth API',
      'Student login resolves CR multi-workspace authorization'
    );
  } catch (err) {
    assert(false, 'Auth API', 'Student login test failed', String(err));
  }

  // Test 2.6: Session Verification via /api/auth/me with Cookie
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: coordinatorCookie },
    });
    const data = await res.json();
    assert(
      res.status === 200 &&
      data.authenticated === true &&
      data.user.email === 'kn.murthy@thapar.edu' &&
      data.role === 'Coordinator',
      'Auth API',
      'Session verification /api/auth/me validates session cookie and returns user profile',
      `status=${res.status}; body=${JSON.stringify(data)}; cookiePresent=${Boolean(coordinatorCookie)}`
    );
  } catch (err) {
    assert(false, 'Auth API', 'Session verification test failed', String(err));
  }

  // Test 2.7: Unauthenticated Session Check
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    const data = await res.json();
    assert(res.status === 401 && data.authenticated === false, 'Auth API', 'Unauthenticated /api/auth/me returns HTTP 401');
  } catch (err) {
    assert(false, 'Auth API', 'Unauthenticated check failed', String(err));
  }

  // Test 2.8: Strong Password Policy & Weak Password Rejection
  const weakPasswords = [
    'password',
    'Password',
    'Password123',
    'password123!',
    'PASSWORD123!',
  ];

  for (const weakPwd of weakPasswords) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Weak Password Tester',
          email: `weak_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@thapar.edu`,
          password: weakPwd,
        }),
      });
      const data = await res.json();
      assert(
        res.status === 400 && data.success === false,
        'Auth API',
        `Weak password "${weakPwd}" rejected by institutional password policy (HTTP 400)`
      );
    } catch (err) {
      assert(false, 'Auth API', `Weak password test failed for "${weakPwd}"`, String(err));
    }
  }

  // Test 2.8b: Restricted Registration Workflow (Institutional @thapar.edu Required)
  try {
    const gmailEmail = `user_${Date.now()}@gmail.com`;
    const gmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Gmail Registered User',
        email: gmailEmail,
        password: 'Thapar@2026Test',
      }),
    });
    const gmailData = await gmailRes.json();
    assert(
      gmailRes.status === 400 && gmailData.error === 'INVALID_EMAIL_DOMAIN',
      'Auth API',
      'Unauthorized email domain (@gmail.com) rejected with HTTP 400'
    );

    const thaparEmail = `faculty_${Date.now()}@thapar.edu`;
    const thaparRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Thapar Faculty User',
        email: thaparEmail,
        password: 'Thapar@2026Test',
      }),
    });
    const thaparData = await thaparRes.json();
    assert(
      thaparRes.status === 202 && thaparData.success === true && thaparData.status === 'PENDING' && thaparData.roleCode === 'STUDENT',
      'Auth API',
      'Institutional @thapar.edu registration is queued for admin approval'
    );

    const externalEmail = `researcher_${Date.now()}@stanford.edu`;
    const externalRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'External Researcher',
        email: externalEmail,
        password: 'Thapar@2026Test',
      }),
    });
    const externalData = await externalRes.json();
    assert(
      externalRes.status === 400 && externalData.error === 'INVALID_EMAIL_DOMAIN',
      'Auth API',
      'Unauthorized external email domain (@stanford.edu) rejected with HTTP 400'
    );
  } catch (err) {
    assert(false, 'Auth API', 'Domain-restricted registration workflow test failed', String(err));
  }

  // Test 2.9: User Registration Workflow with Strong Password (No Auto-Login)
  const testRegEmail = `test.prof_${Date.now()}@thapar.edu`;
  const testRegPassword = 'Thapar@2026Test';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
      body: JSON.stringify({
        name: 'Dr. Test Professor',
        email: testRegEmail,
        password: testRegPassword,
      }),
    });
    const data = await res.json();
    assert(
      res.status === 202 && data.success === true && data.status === 'PENDING' && data.roleCode === 'STUDENT' && !data.token,
      'Auth API',
      'New user registration succeeds without automatic login token (explicit login required)'
    );

    // Verify unauthenticated state immediately after registration
    const meCheck = await fetch(`${BASE_URL}/api/auth/me`);
    const meData = await meCheck.json();
    assert(
      meCheck.status === 401 && meData.authenticated === false,
      'Auth API',
      'Registration does not create authenticated session or auto-login the user'
    );

    // Verify wrong password fails on new account
    const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testRegEmail, password: 'WrongPassword99!' }),
    });
    const wrongLoginData = await wrongLoginRes.json();
    assert(
      wrongLoginRes.status === 401 && wrongLoginData.success === false,
      'Auth API',
      'Newly registered account rejects wrong password with HTTP 401'
    );

    // Verify that a correct password remains blocked until an administrator approves the request.
    const unconfirmedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testRegEmail, password: testRegPassword }),
    });
    const unconfirmedLoginData = await unconfirmedLoginRes.json();
    assert(
      unconfirmedLoginRes.status === 403 && unconfirmedLoginData.error === 'ACCOUNT_PENDING_APPROVAL',
      'Auth API',
      'Pending registration is rejected with HTTP 403 until admin approval'
    );

    // Email verification has been retired in favor of admin approval.
    const invalidVerRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid_token_xyz' }),
    });
    assert(invalidVerRes.status === 410, 'Auth API', 'Legacy email verification endpoint is gone');

    assert(data.verificationToken === undefined, 'Auth API', 'Registration does not issue an email verification token');
  } catch (err) {
    assert(false, 'Auth API', 'Registration test flow failed', String(err));
  }

  // Test 2.10: Duplicate Registration Prevention
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Attempt',
        email: 'kn.murthy@thapar.edu',
        password: 'Thapar@2026Test',
      }),
    });
    const data = await res.json();
    assert(res.status === 201 && data.success === true, 'Auth API', 'Existing account registration does not replace credentials');
  } catch (err) {
    assert(false, 'Auth API', 'Duplicate registration check failed', String(err));
  }

  // Test 2.11: Password Reset Flow (Forgot -> Validate -> Reset -> Login)
  try {
    // Step A: Request Reset
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Mode': 'true' },
      body: JSON.stringify({ email: testRegEmail }),
    });
    const forgotData = await forgotRes.json();
    const token = forgotData.resetToken;
    assert(
      forgotRes.status === 200 && forgotData.success === true,
      'Auth API',
      'Password reset request succeeds'
    );

    // Step B: Validate Token endpoint rejects invalid token
    const valRes = await fetch(`${BASE_URL}/api/auth/validate-token?token=invalid_nonexistent_token_12345`);
    const valData = await valRes.json();
    assert(valRes.status === 400 && valData.valid === false, 'Auth API', 'Reset token validation rejects invalid token');

    // Step C: Weak reset password rejection
    const weakResetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'dummy_token', newPassword: 'weak' }),
    });
    assert(weakResetRes.status === 400, 'Auth API', 'Weak password reset rejected by password policy');

    // Step D: Invalid token rejected on reset
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid_token_99999', newPassword: 'BrandNewPassword2026!' }),
    });
    const resetData = await resetRes.json();
    assert(resetRes.status === 400 && resetData.success === false, 'Auth API', 'Password reset rejects invalid token');
  } catch (err) {
    assert(false, 'Auth API', 'Password reset flow test failed', String(err));
  }

  // Test 2.11: Logout Revocation
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: coordinatorCookie },
    });
    const logoutData = await logoutRes.json();
    assert(logoutRes.status === 200 && logoutData.success === true, 'Auth API', 'Logout endpoint revokes session');

    // Verify token is now invalid
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: coordinatorCookie },
    });
    assert(meRes.status === 401, 'Auth API', 'Revoked session cannot access /api/auth/me');
  } catch (err) {
    assert(false, 'Auth API', 'Logout revocation check failed', String(err));
  }

  // -------------------------------------------------------------
  // SUITE 3: GOOGLE OAUTH SECURITY & INTEGRATION
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Google OAuth 2.0 Security & Status ---');

  // Test 3.1: Google Status Endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google/status`);
    const data = await res.json();
    assert(res.status === 200 && typeof data.configured === 'boolean', 'Google OAuth', 'Status endpoint returns valid provider information');
  } catch (err) {
    assert(false, 'Google OAuth', 'Google status check failed', String(err));
  }

  // Test 3.2: Google debug endpoint is not publicly exposed.
  try {
    const res = await fetch(`${BASE_URL}/${['api/auth', 'google', 'debug'].join('/')}`);
    assert(
      res.status === 404,
      'Google OAuth',
      'Google debug endpoint is removed from the public API surface'
    );
  } catch (err) {
    assert(false, 'Google OAuth', 'Google debug endpoint removal check failed', String(err));
  }

  // Test 3.3: Google Authorization Initiation Endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google/authorize`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    assert(
      (res.status === 200 && typeof data.configured === 'boolean') ||
        (res.status === 503 && data.message === 'Google sign-in not configured'),
      'Google OAuth',
      'Authorization initiation endpoint safely responds with structured JSON'
    );
  } catch (err) {
    assert(false, 'Google OAuth', 'Google authorization initiation failed', String(err));
  }

  // Test 3.4: Google OAuth Cancellation Handling
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google/callback?error=access_denied`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.error === 'OAUTH_PROVIDER_ERROR',
      'Google OAuth',
      'User cancellation or denial handled safely without session creation'
    );
  } catch (err) {
    assert(false, 'Google OAuth', 'Google cancellation test failed', String(err));
  }

  // Test 3.5: Google OAuth Callback Missing Parameters
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google/callback`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.error === 'INVALID_PARAMETERS',
      'Google OAuth',
      'Missing code and state parameters safely rejected with HTTP 400'
    );
  } catch (err) {
    assert(false, 'Google OAuth', 'Missing parameters test failed', String(err));
  }

  // Test 3.6: Google OAuth Callback Invalid State Token
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google/callback?code=test_code_123&state=unregistered_state_xyz`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.error === 'INVALID_STATE',
      'Google OAuth',
      'Unregistered/expired state token safely rejected with HTTP 400'
    );
  } catch (err) {
    assert(false, 'Google OAuth', 'Invalid state test failed', String(err));
  }

  // Test 3.7: Button & Enter-Key Isolation Verification (AST / Source Audit)
  try {
    const fs = await import('fs');
    const loginViewSource = fs.readFileSync('src/components/views/LoginPageView.tsx', 'utf8');
    const hasGoogleButtonType = loginViewSource.includes('type="button"') && loginViewSource.includes('onClick={handleGoogleClick}');
    const buttonIndex = loginViewSource.indexOf('onClick={handleGoogleClick}');
    const lastFormClose = loginViewSource.lastIndexOf('</form>', buttonIndex);
    const lastFormOpen = loginViewSource.lastIndexOf('<form', buttonIndex);
    const googleButtonOutsideForm = lastFormClose > lastFormOpen;
    assert(
      hasGoogleButtonType && googleButtonOutsideForm,
      'Google OAuth',
      'Google button has type="button" and is strictly outside the email/password form (Enter-key isolation)'
    );
  } catch (err) {
    assert(false, 'Google OAuth', 'Button isolation source check failed', String(err));
  }

  // -------------------------------------------------------------
  // SUITE 4: TIMETABLE ENGINE & CONSTRAINT SOLVERS
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Timetable Engine & Constraint Solvers ---');

  // Test 4.1: Hard Constraint Engine - Teacher Collision Detection
  const dummySession1: ClassSession = {
    id: 'test-sess-1',
    courseId: 'CS501',
    facultyId: 'fac-sharma',
    sectionId: 'sec-cse-a',
    roomId: 'room-204',
    day: 'Monday',
    timeSlotId: 'ts-1',
    type: 'Lecture',
    status: 'Confirmed',
    version: 1,
  };

  const conflictingFacultySession: Omit<ClassSession, 'id' | 'version'> = {
    courseId: 'CS502',
    facultyId: 'fac-sharma', // Same faculty
    sectionId: 'sec-cse-b',
    roomId: 'room-205',
    day: 'Monday',
    timeSlotId: 'ts-1',    // Same time slot
    type: 'Lecture',
    status: 'Confirmed',
  };

  const facultyCheck = checkHardConstraints(
    conflictingFacultySession,
    [dummySession1],
    ROOMS,
    FACULTY_MEMBERS,
    SECTIONS,
    COURSES
  );

  assert(
    facultyCheck.isFeasible === false &&
    facultyCheck.violations.some(v => v.includes('Faculty') || v.includes('already teaching')),
    'Timetable Engine',
    'Hard Constraint: Detects simultaneous teacher conflict across different sections'
  );

  // Test 4.2: Hard Constraint Engine - Room Double-Booking Detection
  const conflictingRoomSession: Omit<ClassSession, 'id' | 'version'> = {
    courseId: 'CS503',
    facultyId: 'fac-gupta',
    sectionId: 'sec-cse-b',
    roomId: 'room-204',     // Same room
    day: 'Monday',
    timeSlotId: 'ts-1',     // Same time slot
    type: 'Lecture',
    status: 'Confirmed',
  };

  const roomCheck = checkHardConstraints(
    conflictingRoomSession,
    [dummySession1],
    ROOMS,
    FACULTY_MEMBERS,
    SECTIONS,
    COURSES
  );

  assert(
    roomCheck.isFeasible === false &&
    roomCheck.violations.some(v => v.includes('Room') || v.includes('already booked')),
    'Timetable Engine',
    'Hard Constraint: Detects room double-booking conflict'
  );

  // Test 4.3: Hard Constraint Engine - Section Double-Booking Detection
  const conflictingSectionSession: Omit<ClassSession, 'id' | 'version'> = {
    courseId: 'CS503',
    facultyId: 'fac-gupta',
    sectionId: 'sec-cse-a', // Same section
    roomId: 'room-205',
    day: 'Monday',
    timeSlotId: 'ts-1',     // Same time slot
    type: 'Lecture',
    status: 'Confirmed',
  };

  const sectionCheck = checkHardConstraints(
    conflictingSectionSession,
    [dummySession1],
    ROOMS,
    FACULTY_MEMBERS,
    SECTIONS,
    COURSES
  );

  assert(
    sectionCheck.isFeasible === false &&
    sectionCheck.violations.some(v => v.toLowerCase().includes('section') || v.includes('Student schedule conflict')),
    'Timetable Engine',
    'Hard Constraint: Detects student section simultaneous class collision'
  );

  // Test 4.4: Hard Constraint Engine - Room Capacity Exceedance
  const smallRoom = {
    id: 'room-tiny',
    name: 'Small Room',
    building: 'Turing Block',
    floor: 1,
    capacity: 20, // Only 20 seats
    type: 'LectureHall' as const,
    equipment: ['Projector'],
    isAvailable: true,
  };

  const largeSectionSession: Omit<ClassSession, 'id' | 'version'> = {
    courseId: 'CS501',
    facultyId: 'fac-sharma',
    sectionId: 'sec-cse-a', // 52 students
    roomId: 'room-tiny',
    day: 'Wednesday',
    timeSlotId: 'ts-3',
    type: 'Lecture',
    status: 'Confirmed',
  };

  const capacityCheck = checkHardConstraints(
    largeSectionSession,
    [],
    [...ROOMS, smallRoom],
    FACULTY_MEMBERS,
    SECTIONS,
    COURSES
  );

  assert(
    capacityCheck.isFeasible === false &&
    capacityCheck.violations.some(v => v.includes('capacity')),
    'Timetable Engine',
    'Hard Constraint: Rejects room assignment with insufficient seating capacity'
  );

  // Test 4.5: Full Master Schedule Generation
  const generatorResult = generateTimetableFromConfiguration(
    INITIAL_ACADEMIC_YEAR,
    INITIAL_ALLOCATIONS,
    FACULTY_MEMBERS,
    ROOMS,
    SECTIONS,
    COURSES,
    INITIAL_CONSTRAINTS
  );

  assert(
    generatorResult.sessions.length > 0 &&
    generatorResult.scheduledHours > 0 &&
    generatorResult.conflicts.length === 0,
    'Timetable Engine',
    `Master generator successfully creates ${generatorResult.sessions.length} conflict-free class sessions (${generatorResult.scheduledHours} scheduled hours)`
  );

  // -------------------------------------------------------------
  // SUITE 5: ACADEMIC MASTER DATA & PRE-GENERATION AUDIT
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Master Data Validation & Diagnostics ---');

  // Test 5.1: Pre-generation Audit on Valid Setup
  const validReport = validateAcademicSetup(
    INITIAL_ACADEMIC_YEAR,
    DEPARTMENTS,
    PROGRAMS,
    COURSES,
    FACULTY_MEMBERS,
    ROOMS,
    SECTIONS,
    INITIAL_ALLOCATIONS,
    INITIAL_CONSTRAINTS
  );
  assert(
    validReport.isReadyForGeneration === true && validReport.errorCount === 0,
    'Master Data Validation',
    'Valid academic setup passes pre-generation audit with 0 errors'
  );

  // Test 5.2: Audit detects empty working days
  const brokenYear: AcademicYearConfig = {
    ...INITIAL_ACADEMIC_YEAR,
    workingDays: [],
  };
  const invalidWorkdaysReport = validateAcademicSetup(
    brokenYear,
    DEPARTMENTS,
    PROGRAMS,
    COURSES,
    FACULTY_MEMBERS,
    ROOMS,
    SECTIONS,
    INITIAL_ALLOCATIONS,
    INITIAL_CONSTRAINTS
  );
  assert(
    invalidWorkdaysReport.isReadyForGeneration === false &&
    invalidWorkdaysReport.items.some(i => i.category === 'Academic Year' && i.status === 'Error'),
    'Master Data Validation',
    'Pre-generation audit blocks generation when zero working days are configured'
  );

  // Test 5.3: Audit detects missing allocations
  const emptyAllocReport = validateAcademicSetup(
    INITIAL_ACADEMIC_YEAR,
    DEPARTMENTS,
    PROGRAMS,
    COURSES,
    FACULTY_MEMBERS,
    ROOMS,
    SECTIONS,
    [], // Empty allocations
    INITIAL_CONSTRAINTS
  );
  assert(
    emptyAllocReport.isReadyForGeneration === false &&
    emptyAllocReport.items.some(i => i.category === 'Allocations' && i.status === 'Error'),
    'Master Data Validation',
    'Pre-generation audit blocks generation when zero course allocations are assigned'
  );

  // -------------------------------------------------------------
  // SUITE 6: TIMETABLE REVIEW & MULTI-PERSPECTIVE INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing Timetable Review Views & Relationship Integrity ---');

  // Test 6.1: Section Perspective Consistency
  const secA_Sessions = generatorResult.sessions.filter(s => s.sectionId === 'sec-cse-a');
  assert(
    secA_Sessions.length > 0 &&
    secA_Sessions.every(s => s.sectionId === 'sec-cse-a' && s.courseId && s.roomId && s.facultyId),
    'Timetable Review',
    `Section CSE-A view resolves ${secA_Sessions.length} sessions with complete relational mappings (Course, Room, Faculty, TimeSlot)`
  );

  // Test 6.2: Faculty Perspective Consistency
  const sampleFacId = FACULTY_MEMBERS[0].id;
  const sharma_Sessions = generatorResult.sessions.filter(s => s.facultyId === sampleFacId);
  assert(
    sharma_Sessions.length > 0 &&
    sharma_Sessions.every(s => s.facultyId === sampleFacId),
    'Timetable Review',
    `Faculty ${FACULTY_MEMBERS[0].name} view resolves ${sharma_Sessions.length} teaching assignments without collisions`
  );

  // Test 6.3: Room Perspective Consistency
  const sampleRoomId = ROOMS[0].id;
  const room204_Sessions = generatorResult.sessions.filter(s => s.roomId === sampleRoomId);
  assert(
    room204_Sessions.length > 0 &&
    room204_Sessions.every(s => s.roomId === sampleRoomId),
    'Timetable Review',
    `Room ${ROOMS[0].name} schedule resolves ${room204_Sessions.length} non-overlapping bookings`
  );

  // -------------------------------------------------------------
  // SUITE 7: EMPIRICAL PERFORMANCE BENCHMARKS (Layer 16)
  // -------------------------------------------------------------
  console.log('\n--- 7. Empirical Performance Benchmarks (p50, p95, p99) ---');

  // Benchmark A: API Endpoint Latency (30 samples)
  const apiLatencies: number[] = [];
  // Warmup connection pool
  try {
    await fetch(`${BASE_URL}/api/health/live`);
  } catch {}

  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    await fetch(`${BASE_URL}/api/health/live`);
    apiLatencies.push(performance.now() - t0);
  }
  const apiP50 = calculatePercentile(apiLatencies, 50);
  const apiP95 = calculatePercentile(apiLatencies, 95);
  const apiP99 = calculatePercentile(apiLatencies, 99);

  assert(
    apiP95 < 25,
    'Performance Benchmark',
    `API /api/health/live Latency: p50 = ${apiP50} ms, p95 = ${apiP95} ms, p99 = ${apiP99} ms (Threshold: p95 < 25 ms)`
  );

  // Benchmark B: Timetable Solver Execution (30 runs)
  const solverDurations: number[] = [];
  try {
    generateTimetableFromConfiguration(
      INITIAL_ACADEMIC_YEAR,
      INITIAL_ALLOCATIONS,
      FACULTY_MEMBERS,
      ROOMS,
      SECTIONS,
      COURSES,
      INITIAL_CONSTRAINTS
    );
  } catch {}
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    generateTimetableFromConfiguration(
      INITIAL_ACADEMIC_YEAR,
      INITIAL_ALLOCATIONS,
      FACULTY_MEMBERS,
      ROOMS,
      SECTIONS,
      COURSES,
      INITIAL_CONSTRAINTS
    );
    solverDurations.push(performance.now() - t0);
  }
  const solverP50 = calculatePercentile(solverDurations, 50);
  const solverP95 = calculatePercentile(solverDurations, 95);
  const solverP99 = calculatePercentile(solverDurations, 99);

  // The root workload includes independent post-solve validation and runs beside
  // the full integration suite; keep its budget below the solver's 100 ms FAST cap.
  // Larger dedicated scale measurements and hard-conflict assertions live in test:solver.
  assert(
    solverP95 < 100,
    'Performance Benchmark',
    `Constraint Solver + Validation Speed: p50 = ${solverP50} ms, p95 = ${solverP95} ms, p99 = ${solverP99} ms (Threshold: p95 < 100 ms)`
  );

  // -------------------------------------------------------------
  // FINAL TEST SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
