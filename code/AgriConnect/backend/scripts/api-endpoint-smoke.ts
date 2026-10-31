/**
 * Smoke-test every /api/v1 route (public + auth-gated).
 * Run: npx tsx scripts/api-endpoint-smoke.ts
 */
const BASE = process.env.API_BASE ?? 'http://localhost:5001';

type Case = {
  name: string;
  method: string;
  path: string;
  token?: string;
  body?: unknown;
  expect: number | number[];
};

const DEMO = {
  farmer: { email: 'kabir.manchanda@demo.agriconnect.local', password: 'Demo@AgriConnect1' },
  buyer: { email: 'aman.singh@demo.agriconnect.local', password: 'Demo@AgriConnect1' },
  listingId: 'd1111111-1111-4111-8111-111111111111',
  orderId: 'e1111111-1111-4111-8111-111111111111',
  farmerUserId: 'c1111111-1111-4111-8111-111111111111',
};

async function login(email: string, password: string): Promise<string | null> {
  const response = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: { accessToken?: string } };
  return body.data?.accessToken ?? null;
}

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<number> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
  });
  return response.status;
}

function pass(name: string, status: number, expect: number | number[]) {
  const ok = Array.isArray(expect) ? expect.includes(status) : status === expect;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${status} (expected ${expect})`);
  return ok;
}

async function main() {
  const farmerToken = await login(DEMO.farmer.email, DEMO.farmer.password);
  const buyerToken = await login(DEMO.buyer.email, DEMO.buyer.password);

  if (!farmerToken || !buyerToken) {
    console.error('Could not log in demo farmer/buyer. Run prisma:seed first.');
    process.exitCode = 1;
    return;
  }

  const cases: Case[] = [
    { name: 'GET /health', method: 'GET', path: '/health', expect: 200 },
    { name: 'GET /ready', method: 'GET', path: '/ready', expect: 200 },
    { name: 'GET /api/v1', method: 'GET', path: '/api/v1', expect: 200 },
    { name: 'GET /api/v1/listings', method: 'GET', path: '/api/v1/listings?limit=3', expect: 200 },
    {
      name: 'GET /api/v1/listings/:id',
      method: 'GET',
      path: `/api/v1/listings/${DEMO.listingId}`,
      expect: 200,
    },
    {
      name: 'GET /api/v1/market/prices',
      method: 'GET',
      path: '/api/v1/market/prices?limit=5',
      expect: 200,
    },
    {
      name: 'GET /api/v1/market/prices/summary',
      method: 'GET',
      path: '/api/v1/market/prices/summary',
      expect: 200,
    },
    { name: 'GET /api/v1/market/mandi/states', method: 'GET', path: '/api/v1/market/mandi/states', expect: 200 },
    {
      name: 'GET /api/v1/market/mandi/markets',
      method: 'GET',
      path: '/api/v1/market/mandi/markets?state=Punjab',
      expect: 200,
    },
    {
      name: 'GET /api/v1/market/mandi/prices',
      method: 'GET',
      path: '/api/v1/market/mandi/prices?state=Punjab&commodity=Wheat',
      expect: 200,
    },
    {
      name: 'GET /api/v1/market/mandi/history',
      method: 'GET',
      path: '/api/v1/market/mandi/history?state=Punjab&commodity=Wheat',
      expect: 200,
    },
    {
      name: 'GET /api/v1/users/:id/public',
      method: 'GET',
      path: `/api/v1/users/${DEMO.farmerUserId}/public`,
      expect: 200,
    },
    {
      name: 'GET /api/v1/users/:id/reviews',
      method: 'GET',
      path: `/api/v1/users/${DEMO.farmerUserId}/reviews`,
      expect: 200,
    },
    { name: 'GET /api/v1/assistant/status (no token)', method: 'GET', path: '/api/v1/assistant/status', expect: 401 },
    {
      name: 'GET /api/v1/assistant/status (farmer)',
      method: 'GET',
      path: '/api/v1/assistant/status',
      token: farmerToken,
      expect: 200,
    },
    { name: 'GET /api/v1/auth/me (no token)', method: 'GET', path: '/api/v1/auth/me', expect: 401 },
    { name: 'GET /api/v1/orders (no token)', method: 'GET', path: '/api/v1/orders', expect: 401 },
    { name: 'GET /api/v1/auth/me (farmer)', method: 'GET', path: '/api/v1/auth/me', token: farmerToken, expect: 200 },
    { name: 'GET /api/v1/users/me (farmer)', method: 'GET', path: '/api/v1/users/me', token: farmerToken, expect: 200 },
    {
      name: 'GET /api/v1/users/me/farmer-profile',
      method: 'GET',
      path: '/api/v1/users/me/farmer-profile',
      token: farmerToken,
      expect: 200,
    },
    {
      name: 'GET /api/v1/reports/me (farmer)',
      method: 'GET',
      path: '/api/v1/reports/me',
      token: farmerToken,
      expect: 200,
    },
    {
      name: 'GET /api/v1/notifications (farmer)',
      method: 'GET',
      path: '/api/v1/notifications?limit=5',
      token: farmerToken,
      expect: 200,
    },
    {
      name: 'GET /api/v1/orders (farmer)',
      method: 'GET',
      path: '/api/v1/orders?limit=5',
      token: farmerToken,
      expect: 200,
    },
    {
      name: 'GET /api/v1/orders/:id (farmer)',
      method: 'GET',
      path: `/api/v1/orders/${DEMO.orderId}`,
      token: farmerToken,
      expect: [200, 403, 404],
    },
    {
      name: 'GET /api/v1/orders/:id/messages (farmer)',
      method: 'GET',
      path: `/api/v1/orders/${DEMO.orderId}/messages`,
      token: farmerToken,
      expect: [200, 403, 404],
    },
    {
      name: 'GET /api/v1/orders/:id/reviews (farmer)',
      method: 'GET',
      path: `/api/v1/orders/${DEMO.orderId}/reviews`,
      token: farmerToken,
      expect: [200, 403, 404],
    },
    { name: 'GET /api/v1/auth/me (buyer)', method: 'GET', path: '/api/v1/auth/me', token: buyerToken, expect: 200 },
    {
      name: 'GET /api/v1/users/me/buyer-profile',
      method: 'GET',
      path: '/api/v1/users/me/buyer-profile',
      token: buyerToken,
      expect: 200,
    },
    {
      name: 'GET /api/v1/alerts (buyer)',
      method: 'GET',
      path: '/api/v1/alerts',
      token: buyerToken,
      expect: 200,
    },
    {
      name: 'GET /api/v1/alerts (farmer forbidden)',
      method: 'GET',
      path: '/api/v1/alerts',
      token: farmerToken,
      expect: 403,
    },
    {
      name: 'GET /api/v1/admin/users (buyer forbidden)',
      method: 'GET',
      path: '/api/v1/admin/users',
      token: buyerToken,
      expect: 403,
    },
    {
      name: 'POST /api/v1/orders (farmer forbidden)',
      method: 'POST',
      path: '/api/v1/orders',
      token: farmerToken,
      body: { listingId: DEMO.listingId, quantity: '1', deliveryMode: 'pickup' },
      expect: 403,
    },
  ];

  let failed = 0;
  for (const testCase of cases) {
    const status = await request(testCase.method, testCase.path, {
      token: testCase.token,
      body: testCase.body,
    });
    if (!pass(testCase.name, status, testCase.expect)) failed += 1;
  }

  console.log(`\n${cases.length - failed}/${cases.length} endpoint checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
