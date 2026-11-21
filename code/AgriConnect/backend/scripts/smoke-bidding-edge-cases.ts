/**
 * Exhaustive edge-case test suite for B2B Bidding & Counter-Offer Negotiation.
 * Covers: Auth, RBAC, boundary conditions, anti-disintermediation,
 * state machine invariants, counter-offers, and atomic order conversion.
 *
 * Run: npx tsx scripts/smoke-bidding-edge-cases.ts
 */
import { connectDatabase, disconnectDatabase, getPrismaClient } from '../src/config/db.js';

const BASE = process.env.API_BASE ?? 'http://localhost:5001';
const stamp = Date.now();
const farmerEmail = `edge-farmer-${stamp}@agriconnect.test`;
const buyerEmail = `edge-buyer-${stamp}@agriconnect.test`;
const attackerEmail = `edge-attacker-${stamp}@agriconnect.test`;
const password = 'TestPassword123!';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function api<T = any>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  return { status: response.status, body };
}

let passCount = 0;
let failCount = 0;

function assertTest(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passCount++;
    console.log(`  ✓ [PASS] ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    failCount++;
    console.error(`  ✗ [FAIL] ${label}${detail ? ` (${detail})` : ''}`);
    throw new Error(`Assertion failed: ${label} - Detail: ${detail}`);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('  AGRICONNECT B2B BIDDING & NEGOTIATION EDGE-CASE SUITE');
  console.log('======================================================\n');

  await connectDatabase();
  const prisma = getPrismaClient();

  // 1. Setup Test Users
  console.log('Setup: Registering test actors (Farmer, Buyer, Attacker)...');
  const regFarmer = await api<{ accessToken: string; user: { id: string } }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: farmerEmail,
      password,
      name: 'Test Farmer Edge',
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'FARMER',
      state: 'Punjab',
      district: 'Ludhiana',
    }),
  });
  assertTest('Register test farmer', regFarmer.status === 201 && !!regFarmer.body.data?.accessToken, JSON.stringify(regFarmer.body));
  const farmerToken = regFarmer.body.data!.accessToken;
  const farmerId = regFarmer.body.data!.user.id;

  const regBuyer = await api<{ accessToken: string; user: { id: string } }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerEmail,
      password,
      name: 'Test Buyer Edge',
      phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'BUYER',
      state: 'Delhi',
      district: 'Central',
    }),
  });
  assertTest('Register test buyer', regBuyer.status === 201 && !!regBuyer.body.data?.accessToken, JSON.stringify(regBuyer.body));
  const buyerToken = regBuyer.body.data!.accessToken;
  const buyerId = regBuyer.body.data!.user.id;

  const regAttacker = await api<{ accessToken: string; user: { id: string } }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: attackerEmail,
      password,
      name: 'Test Other Buyer',
      phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'BUYER',
      state: 'Haryana',
      district: 'Ambala',
    }),
  });
  assertTest('Register test other buyer', regAttacker.status === 201 && !!regAttacker.body.data?.accessToken, JSON.stringify(regAttacker.body));
  const attackerToken = regAttacker.body.data!.accessToken;

  // 2. Farmer creates test listing (Wheat lot: 50 quintals, min 5 quintals, price ₹2,400)
  console.log('\nSetup: Creating farmer produce listing (50 quintals @ ₹2,400)...');
  const farmerProfile = await prisma.farmerProfile.findFirst({ where: { userId: farmerId } });
  const listing = await prisma.listing.create({
    data: {
      farmerProfileId: farmerProfile!.id,
      crop: 'Wheat Edge Test',
      category: 'Grains',
      variety: 'Sharbati Gold',
      quantity: 50.0,
      unit: 'quintal',
      pricePerUnit: 2400.0,
      minimumOrderQuantity: 5.0,
      state: 'Punjab',
      district: 'Ludhiana',
      harvestDate: new Date(),
      status: 'active',
      perishable: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      photos: {
        create: {
          storagePath: 'listings/demo-wheat.jpg',
          publicUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b',
          sortOrder: 0,
        },
      },
    },
  });
  assertTest('Farmer listing created in database', !!listing.id);
  const listingId = listing.id;

  // SECTION 1: AUTH & RBAC EDGE CASES
  console.log('\n--- SECTION 1: AUTHENTICATION & ROLE-BASED ACCESS CONTROL ---');

  const unauthBid = await api('/api/v1/bids', {
    method: 'POST',
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2200.00',
      quantity: '10.000',
    }),
  });
  assertTest('Edge Case 1: Unauthenticated request to create bid is rejected', unauthBid.status === 401);

  const farmerBidOnOwn = await api('/api/v1/bids', {
    method: 'POST',
    token: farmerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2200.00',
      quantity: '10.000',
    }),
  });
  assertTest('Edge Case 2: Farmer role cannot place bids', farmerBidOnOwn.status === 403);

  const buyerIncomingBids = await api('/api/v1/bids/incoming', {
    method: 'GET',
    token: buyerToken,
  });
  assertTest('Edge Case 3: Buyer role cannot access incoming farmer bids list', buyerIncomingBids.status === 403);

  // SECTION 2: INPUT VALIDATION & QUANTITY BOUNDARY EDGE CASES
  console.log('\n--- SECTION 2: QUANTITY & PRICE BOUNDARY EDGE CASES ---');

  const negPrice = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '-500.00',
      quantity: '10.000',
    }),
  });
  assertTest('Edge Case 4: Negative price per unit is rejected by Zod schema', negPrice.status === 400);

  const zeroPrice = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '0.00',
      quantity: '10.000',
    }),
  });
  assertTest('Edge Case 5: Zero price per unit is rejected', zeroPrice.status === 400);

  const subMinQty = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2200.00',
      quantity: '2.000', // min is 5.000
    }),
  });
  assertTest('Edge Case 6: Quantity below minimumOrderQuantity is rejected', subMinQty.status === 400);

  const overStockQty = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2200.00',
      quantity: '75.000', // stock is 50.000
    }),
  });
  assertTest('Edge Case 7: Quantity exceeding available stock is rejected', overStockQty.status === 400);

  // SECTION 3: ANTI-DISINTERMEDIATION SECURITY
  console.log('\n--- SECTION 3: ANTI-DISINTERMEDIATION CONTACT GUARDS ---');

  const phoneBid = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2200.00',
      quantity: '10.000',
      notes: 'Call me on 9876543210 to deal in cash outside',
    }),
  });
  assertTest('Edge Case 8: 10-digit mobile number in notes is blocked (CONTACT_INFO_BLOCKED)', phoneBid.status === 400);

  const spacedPhoneBid = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2200.00',
      quantity: '10.000',
      notes: 'WhatsApp me at 9 8 7 6 5 4 3 2 1 0',
    }),
  });
  assertTest('Edge Case 9: Obfuscated spaced phone number is blocked', spacedPhoneBid.status === 400);

  const emailBid = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2200.00',
      quantity: '10.000',
      notes: 'Email me at cheat@middleman.com to bypass commission',
    }),
  });
  assertTest('Edge Case 10: Email address in notes is blocked', emailBid.status === 400);

  // SECTION 4: VALID BID PLACEMENT & NOTIFICATION VERIFICATION
  console.log('\n--- SECTION 4: VALID BID PLACEMENT & NOTIFICATION ---');

  const validBidRes = await api<{ id: string; status: string; priceTotal: string }>('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2100.00',
      quantity: '10.000',
      notes: 'Standard warehouse delivery required with grade cert',
    }),
  });
  assertTest('Edge Case 11: Valid bid creation succeeds with HTTP 201', validBidRes.status === 201);
  const bid1 = validBidRes.body.data!;
  assertTest('Bid total calculated accurately (10 × ₹2,100 = ₹21,000)', bid1.priceTotal === '21000.00');
  assertTest('Initial bid status is pending', bid1.status === 'pending');

  // Verify farmer received notification
  const farmerNotifs = await prisma.notification.findMany({
    where: { userId: farmerId, type: 'BID_RECEIVED' },
  });
  assertTest('Edge Case 12: Farmer receives BID_RECEIVED notification', farmerNotifs.length > 0);

  // SECTION 5: UNAUTHORIZED ACTIONS ON PENDING BID
  console.log('\n--- SECTION 5: UNAUTHORIZED ACTIONS ON PENDING BID ---');

  const buyerAcceptOwn = await api(`/api/v1/bids/${bid1.id}/accept`, {
    method: 'POST',
    token: buyerToken,
  });
  assertTest('Edge Case 13: Buyer cannot accept their own pending bid (Only farmer can accept pending)', buyerAcceptOwn.status === 403);

  const attackerCounter = await api(`/api/v1/bids/${bid1.id}/counter`, {
    method: 'POST',
    token: attackerToken,
    body: JSON.stringify({ counterPrice: '2300.00' }),
  });
  assertTest('Edge Case 14: Non-owner cannot counter a bid', attackerCounter.status === 403);

  // SECTION 6: FARMER COUNTER-OFFER WORKFLOW
  console.log('\n--- SECTION 6: FARMER COUNTER-OFFER WORKFLOW ---');

  const farmerCounterPhone = await api(`/api/v1/bids/${bid1.id}/counter`, {
    method: 'POST',
    token: farmerToken,
    body: JSON.stringify({
      counterPrice: '2250.00',
      notes: 'Call 9876543210 for final agreement',
    }),
  });
  assertTest('Edge Case 15: Farmer counter with phone number blocked by contactGuard', farmerCounterPhone.status === 400);

  const farmerValidCounter = await api<{ id: string; status: string; counterPrice: string }>(`/api/v1/bids/${bid1.id}/counter`, {
    method: 'POST',
    token: farmerToken,
    body: JSON.stringify({
      counterPrice: '2250.00',
      notes: 'Prevailing mandi modal rate is ₹2,350. ₹2,250 is my best offer.',
    }),
  });
  assertTest('Edge Case 16: Farmer counter-offer succeeds with HTTP 200', farmerValidCounter.status === 200);
  assertTest('Bid status transitioned to countered', farmerValidCounter.body.data?.status === 'countered');
  assertTest('Counter price recorded as 2250.00', farmerValidCounter.body.data?.counterPrice === '2250.00');

  // Verify buyer received BID_COUNTERED notification
  const buyerNotifs = await prisma.notification.findMany({
    where: { userId: buyerId, type: 'BID_COUNTERED' },
  });
  assertTest('Edge Case 17: Buyer receives BID_COUNTERED notification', buyerNotifs.length > 0);

  // Repeat counter / invalid transitions
  const doubleCounter = await api(`/api/v1/bids/${bid1.id}/counter`, {
    method: 'POST',
    token: farmerToken,
    body: JSON.stringify({ counterPrice: '2300.00' }),
  });
  assertTest('Edge Case 18: Cannot counter an already countered bid', doubleCounter.status === 400);

  const rejectCountered = await api(`/api/v1/bids/${bid1.id}/reject`, {
    method: 'POST',
    token: farmerToken,
    body: JSON.stringify({ rejectionReason: 'Changed mind' }),
  });
  assertTest('Edge Case 19: Cannot reject an already countered bid', rejectCountered.status === 400);

  // SECTION 7: BUYER ACCEPTS COUNTER-OFFER & ATOMIC ORDER CREATION
  console.log('\n--- SECTION 7: BUYER ACCEPTS COUNTER-OFFER & ATOMIC ORDER CONVERSION ---');

  const buyerAcceptCounter = await api<{ bid: { status: string; orderId: string }; order: { id: string; priceTotal: string; status: string } }>(
    `/api/v1/bids/${bid1.id}/accept`,
    {
      method: 'POST',
      token: buyerToken,
    },
  );
  assertTest('Edge Case 20: Buyer successfully accepts counter-offer', buyerAcceptCounter.status === 200);
  const acceptedData = buyerAcceptCounter.body.data!;
  assertTest('Bid status transitioned to accepted', acceptedData.bid.status === 'accepted');
  assertTest('Order created with pending status', acceptedData.order.status === 'pending');
  assertTest('Order total is 10 × ₹2,250 = ₹22,500.00', acceptedData.order.priceTotal === '22500.00');

  // Verify atomic inventory reservation in database
  const updatedListing = await prisma.listing.findUnique({ where: { id: listingId } });
  assertTest('Edge Case 21: Listing inventory decremented from 50 to 40 quintals', Number(updatedListing?.quantity) === 40);

  // SECTION 8: POST-ACCEPTANCE GUARDRAILS
  console.log('\n--- SECTION 8: POST-ACCEPTANCE STATE INVARIANTS ---');

  const withdrawAccepted = await api(`/api/v1/bids/${bid1.id}/withdraw`, {
    method: 'POST',
    token: buyerToken,
  });
  assertTest('Edge Case 22: Cannot withdraw an already accepted bid', withdrawAccepted.status === 400);

  const counterAccepted = await api(`/api/v1/bids/${bid1.id}/counter`, {
    method: 'POST',
    token: farmerToken,
    body: JSON.stringify({ counterPrice: '2500.00' }),
  });
  assertTest('Edge Case 23: Cannot counter an already accepted bid', counterAccepted.status === 400);

  // SECTION 9: BUYER WITHDRAWAL LIFECYCLE
  console.log('\n--- SECTION 9: BUYER WITHDRAWAL LIFECYCLE ---');

  const bid2Res = await api<{ id: string }>('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2000.00',
      quantity: '5.000',
      notes: 'Second offer for withdrawal test',
    }),
  });
  const bid2Id = bid2Res.body.data!.id;

  const withdrawBid2 = await api<{ status: string }>(`/api/v1/bids/${bid2Id}/withdraw`, {
    method: 'POST',
    token: buyerToken,
  });
  assertTest('Edge Case 24: Buyer can withdraw pending bid', withdrawBid2.status === 200 && withdrawBid2.body.data?.status === 'withdrawn');

  const farmerAcceptWithdrawn = await api(`/api/v1/bids/${bid2Id}/accept`, {
    method: 'POST',
    token: farmerToken,
  });
  assertTest('Edge Case 25: Farmer cannot accept a withdrawn bid', farmerAcceptWithdrawn.status === 400);

  // SECTION 10: DIRECT FARMER ACCEPTANCE & STOCK DEPLETION
  console.log('\n--- SECTION 10: DIRECT FARMER ACCEPTANCE & STOCK DEPLETION ---');

  // Place bid for 40 quintals (all remaining stock)
  const bid3Res = await api<{ id: string }>('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2350.00',
      quantity: '40.000',
      notes: 'Buying remaining 40 quintals direct',
    }),
  });
  const bid3Id = bid3Res.body.data!.id;

  const farmerAcceptDirect = await api<{ bid: { status: string }; order: { id: string } }>(`/api/v1/bids/${bid3Id}/accept`, {
    method: 'POST',
    token: farmerToken,
  });
  assertTest('Edge Case 26: Farmer directly accepts pending bid', farmerAcceptDirect.status === 200 && farmerAcceptDirect.body.data?.bid.status === 'accepted');

  // Verify stock is now 0 and listing is sold_out
  const depletedListing = await prisma.listing.findUnique({ where: { id: listingId } });
  assertTest('Edge Case 27: Remaining quantity is now 0.000', Number(depletedListing?.quantity) === 0);
  assertTest('Edge Case 28: Listing status transitioned to sold_out', depletedListing?.status === 'sold_out');

  // Attempting to bid on sold_out listing
  const bidOnSoldOut = await api('/api/v1/bids', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      pricePerUnit: '2400.00',
      quantity: '5.000',
    }),
  });
  assertTest('Edge Case 29: Cannot place bid on sold-out listing (404/not active)', bidOnSoldOut.status === 404);

  // Clean up
  await prisma.bid.deleteMany({ where: { listingId } });
  await prisma.order.deleteMany({ where: { listingId } });
  await prisma.listing.deleteMany({ where: { id: listingId } });
  await prisma.notification.deleteMany({ where: { userId: { in: [farmerId, buyerId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [farmerId, buyerId, regAttacker.body.data!.user.id] } } });

  await disconnectDatabase();

  console.log('\n======================================================');
  console.log(`  ALL ${passCount} EDGE-CASE TESTS PASSED PERFECTLY! (0 FAILS)`);
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('\nTest runner failed:', err);
  process.exit(1);
});
