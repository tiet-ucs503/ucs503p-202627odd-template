import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
const supabaseAnon = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface TestResult {
  step: string;
  description: string;
  passed: boolean;
  details?: any;
}

const results: TestResult[] = [];

function recordTest(passed: boolean, step: string, description: string, details?: any) {
  results.push({ step, description, passed, details });
  const icon = passed ? '✓ [PASS]' : '✗ [FAIL]';
  console.log(`  ${icon} [${step}] ${description}`);
  if (!passed && details) {
    console.error('     Failure details:', details);
  }
}

async function runAuthArchitectureTestSuite() {
  console.log('================================================================');
  console.log('SUPABASE AUTH ARCHITECTURAL & PASSWORD VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  if (!supabaseAdmin || !supabaseAnon) {
    throw new Error('Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY) must be provided.');
  }

  let serverReady = false;
  for (let i = 0; i < 10; i++) {
    try {
      const health = await fetch(`${BASE_URL}/api/health/live`);
      if (health.ok) {
        serverReady = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!serverReady) {
    throw new Error(`Server is not responding at ${BASE_URL}. Ensure dev server is running.`);
  }

  const testEmail = `test-auth-${Date.now()}@thapar.edu`;
  const correctPassword = 'CorrectPassword123!';
  const wrongPassword = 'WrongPassword123!';
  const testName = 'Verified Supabase Student';

  console.log(`--- Test Persona: ${testEmail} ---\n`);

  // -------------------------------------------------------------
  // TEST 1: REGISTRATION CREATES REAL SUPABASE AUTH USER
  // -------------------------------------------------------------
  console.log('--- 1. Testing Registration Flow & auth.users Creation ---');
  const regResp = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: correctPassword,
    }),
  });

  const regData = await regResp.json();
  recordTest(regResp.status === 201 && regData.success === true, 'Registration', 'Registration endpoint returns HTTP 201 Created', { status: regResp.status, body: regData });

  const registeredUserId = regData.user?.id;
  recordTest(Boolean(registeredUserId), 'Registration', 'Registration returns valid user ID', { userId: registeredUserId });

  // Verify directly in Supabase auth.users
  const { data: authUserData, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(registeredUserId);
  recordTest(
    !authUserErr && authUserData?.user?.email?.toLowerCase() === testEmail.toLowerCase(),
    'Supabase Auth Authority',
    'User record confirmed in Supabase auth.users table',
    { authUser: authUserData?.user?.id, email: authUserData?.user?.email, error: authUserErr }
  );

  // Verify public.profiles table
  const { data: profileData, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', registeredUserId)
    .single();

  recordTest(
    !profileErr && profileData?.email?.toLowerCase() === testEmail.toLowerCase(),
    'Relational Profile',
    'Public profile created and linked to auth.users.id',
    { profileId: profileData?.id, role: profileData?.role_code }
  );

  // Simulate user completing email verification
  if (registeredUserId) {
    await supabaseAdmin.auth.admin.updateUserById(registeredUserId, { email_confirm: true });
  }

  // -------------------------------------------------------------
  // TEST 2: LOGIN WITH CORRECT PASSWORD SUCCEEDS
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Login with Correct Password ---');
  const correctLoginResp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: correctPassword,
    }),
  });

  const correctLoginData = await correctLoginResp.json();
  const validToken = correctLoginData.token;
  recordTest(
    correctLoginResp.status === 200 && correctLoginData.success === true && Boolean(validToken),
    'Login Success',
    'Login with correct password returns HTTP 200 & valid session token',
    { status: correctLoginResp.status, tokenPresent: Boolean(validToken) }
  );

  // Verify protected /api/auth/me with valid token
  const meValidResp = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  const meValidData = await meValidResp.json();
  recordTest(
    meValidResp.status === 200 && meValidData.authenticated === true,
    'Session Verification',
    'Authenticated session accesses protected /api/auth/me successfully',
    { status: meValidResp.status, auth: meValidData.authenticated }
  );

  // -------------------------------------------------------------
  // TEST 3: LOGOUT INVALIDATES SESSION
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Logout ---');
  const logoutResp = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  const logoutData = await logoutResp.json();
  recordTest(
    logoutResp.status === 200 && logoutData.success === true,
    'Logout',
    'Logout terminates authenticated session',
    { status: logoutResp.status }
  );

  // Verify token is no longer accepted after logout
  const meRevokedResp = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  recordTest(
    meRevokedResp.status === 401,
    'Session Revocation',
    'Revoked session token is rejected with HTTP 401 on protected endpoint',
    { status: meRevokedResp.status }
  );

  // -------------------------------------------------------------
  // TEST 4: LOGIN WITH WRONG PASSWORD MUST FAIL (CRITICAL BUG FIX)
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Login with WRONG Password (Must Fail) ---');
  const wrongLoginResp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: wrongPassword,
    }),
  });

  const wrongLoginData = await wrongLoginResp.json();
  recordTest(
    wrongLoginResp.status === 401 && wrongLoginData.success === false && !wrongLoginData.token,
    'Wrong Password Security',
    'Wrong password rejected with HTTP 401 (NO session token issued)',
    { status: wrongLoginResp.status, body: wrongLoginData }
  );

  // Direct Supabase Auth test verification
  const directSupabaseWrong = await supabaseAnon.auth.signInWithPassword({
    email: testEmail,
    password: wrongPassword,
  });
  recordTest(
    Boolean(directSupabaseWrong.error) && !directSupabaseWrong.data?.session,
    'Direct Supabase Auth',
    'Direct Supabase Auth client rejects incorrect password',
    { error: directSupabaseWrong.error?.message }
  );

  // -------------------------------------------------------------
  // TEST 5: LOGIN AGAIN WITH CORRECT PASSWORD SUCCEEDS
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Re-Login with Correct Password ---');
  const reLoginResp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: correctPassword,
    }),
  });

  const reLoginData = await reLoginResp.json();
  recordTest(
    reLoginResp.status === 200 && reLoginData.success === true && Boolean(reLoginData.token),
    'Re-Authentication',
    'Re-login with correct password succeeds immediately',
    { status: reLoginResp.status }
  );

  // -------------------------------------------------------------
  // TEST 6: DUPLICATE REGISTRATION PREVENTION
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing Duplicate Registration Prevention ---');
  const dupRegResp = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: correctPassword,
    }),
  });
  recordTest(
    dupRegResp.status === 409,
    'Duplicate Prevention',
    'Duplicate registration rejected with HTTP 409 Conflict',
    { status: dupRegResp.status }
  );

  // Cleanup test user from Supabase Auth & profiles
  if (registeredUserId) {
    await supabaseAdmin.from('profiles').delete().eq('id', registeredUserId);
    await supabaseAdmin.auth.admin.deleteUser(registeredUserId);
    console.log(`\n✓ Cleaned up test user ${registeredUserId} from Supabase.`);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`AUTH ARCHITECTURE TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthArchitectureTestSuite().catch(err => {
  console.error('Fatal error in auth architecture test suite:', err);
  process.exit(1);
});
