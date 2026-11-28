/**
 * Live smoke test for contact-info blocking and payment methods.
 * Run against a local dev server: npx tsx scripts/smoke-antibypass-payments.ts
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:5001';
const EMAIL = process.env.SMOKE_EMAIL ?? 'aman.singh@demo.agriconnect.local';
const FARMER_EMAIL = process.env.SMOKE_FARMER_EMAIL ?? 'kabir.manchanda@demo.agriconnect.local';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'Demo@AgriConnect1';

let token = '';
let failures = 0;

async function call(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  PASS  ${label}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${label}`, detail ? JSON.stringify(detail) : '');
}

/**
 * Places a throwaway order, walks it through escrow, then cancels it so the refund path
 * and the listing stock restore are both exercised.
 */
async function escrowLifecycle(): Promise<void> {
  const listings = await call('/api/v1/listings?status=active&limit=1');
  const listing = listings.json.data?.[0];
  if (!listing) {
    check('found an active listing to order', false, listings.json);
    return;
  }

  await contactGuardOutsideChat(listing.id, listing.minimumOrderQuantity);

  console.log('\nEscrow lifecycle on a throwaway order');

  const created = await call('/api/v1/orders', {
    method: 'POST',
    body: {
      listingId: listing.id,
      quantity: listing.minimumOrderQuantity,
      deliveryMode: 'pickup',
      notes: 'Automated smoke test order',
    },
  });
  const newOrder = created.json.data;
  if (!newOrder?.id) {
    check('placed a test order', false, created.json);
    return;
  }
  check('placed a test order', created.status === 201);

  const cod = await call(`/api/v1/orders/${newOrder.id}/payment`, {
    method: 'POST',
    body: { method: 'cod' },
  });
  check(
    'cod init returns mode=cod and skips escrow',
    cod.status === 201 && cod.json.data?.mode === 'cod' && cod.json.data?.method === 'cod',
    cod.json.data,
  );

  const codHold = await call(`/api/v1/orders/${newOrder.id}/payment/confirm`, { method: 'POST' });
  check('cod cannot be held in escrow', codHold.status === 400, codHold.json);

  const upi = await call(`/api/v1/orders/${newOrder.id}/payment`, {
    method: 'POST',
    body: { method: 'upi' },
  });
  check(
    'switching to upi re-initialises the payment',
    upi.status === 201 && upi.json.data?.method === 'upi',
    upi.json.data,
  );

  // With live Razorpay keys the server verifies the payment with the gateway, so a
  // scripted confirm has no real payment id to offer and must be refused.
  const liveGateway = upi.json.data?.mode === 'razorpay';

  if (liveGateway) {
    const unverified = await call(`/api/v1/orders/${newOrder.id}/payment/confirm`, {
      method: 'POST',
    });
    check(
      'live gateway refuses a confirm with no payment reference',
      unverified.status === 400,
      unverified.json,
    );

    const forged = await call(`/api/v1/orders/${newOrder.id}/payment/confirm`, {
      method: 'POST',
      body: { providerRef: 'pay_forged_reference' },
    });
    check(
      'live gateway refuses an unverifiable payment reference',
      forged.status === 402 || forged.status === 502,
      forged.json,
    );

    console.log('  (escrow hold checks skipped — needs a real Razorpay checkout)');
  } else {
    const held = await call(`/api/v1/orders/${newOrder.id}/payment/confirm`, { method: 'POST' });
    check(
      'confirm moves the payment into escrow',
      held.status === 200 && held.json.data?.status === 'held',
      held.json.data,
    );

    const repeat = await call(`/api/v1/orders/${newOrder.id}/payment/confirm`, { method: 'POST' });
    check('confirm is idempotent', repeat.status === 200 && repeat.json.data?.status === 'held');
  }

  if (!liveGateway) {
    const reinit = await call(`/api/v1/orders/${newOrder.id}/payment`, {
      method: 'POST',
      body: { method: 'card' },
    });
    check('409 when re-paying an escrowed order', reinit.status === 409, reinit.json);
  }

  const cancelled = await call(`/api/v1/orders/${newOrder.id}/status`, {
    method: 'PATCH',
    body: { status: 'cancelled', cancellationReason: 'Smoke test cleanup' },
  });
  // A live-gateway run never reached `held`, so only the mock run proves the refund path.
  if (!liveGateway) {
    check(
      'cancelling refunds the escrowed payment',
      cancelled.status === 200 && cancelled.json.data?.payment?.status === 'refunded',
      cancelled.json.data?.payment,
    );
    check(
      'refundedAt is stamped',
      Boolean(cancelled.json.data?.payment?.refundedAt),
      cancelled.json.data?.payment,
    );
  } else {
    check('order cancels cleanly', cancelled.status === 200, cancelled.json);
  }

  const afterCancel = await call(`/api/v1/orders/${newOrder.id}/payment`, {
    method: 'POST',
    body: { method: 'upi' },
  });
  check('cannot pay a cancelled order', afterCancel.status >= 400, afterCancel.json);
}

/**
 * Chat is not the only way to hand over a number: order notes reach the farmer and a
 * listing description reaches every buyer, so both run the same scan.
 */
async function contactGuardOutsideChat(listingId: string, quantity: string): Promise<void> {
  console.log('\nContact guard outside chat');

  const notes = await call('/api/v1/orders', {
    method: 'POST',
    body: {
      listingId,
      quantity,
      deliveryMode: 'pickup',
      notes: 'ring me on 9876543210 before pickup',
    },
  });
  check(
    'order notes cannot carry a phone number',
    notes.status === 400 && notes.json.error?.code === 'CONTACT_INFO_BLOCKED',
    notes.json,
  );
  check('the blocked field is named', Boolean(notes.json.error?.fields?.notes), notes.json.error);

  const upiNotes = await call('/api/v1/orders', {
    method: 'POST',
    body: {
      listingId,
      quantity,
      deliveryMode: 'pickup',
      notes: 'send the money to farmer99@oksbi',
    },
  });
  check(
    'order notes cannot carry a UPI id',
    upiNotes.status === 400 && upiNotes.json.error?.code === 'CONTACT_INFO_BLOCKED',
    upiNotes.json,
  );

  // Listings are farmer-owned, so this half needs the farmer's token.
  const buyerToken = token;
  const farmerLogin = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { email: FARMER_EMAIL, password: PASSWORD },
  });
  const farmerToken = farmerLogin.json?.data?.accessToken ?? '';
  if (!farmerToken) {
    check('logged in as the demo farmer for listing checks', false, farmerLogin.json);
    return;
  }

  token = farmerToken;
  try {
    const listingBody = {
      crop: 'Wheat',
      category: 'grain',
      quantity: '100',
      unit: 'quintal',
      pricePerUnit: '2400',
      minimumOrderQuantity: '10',
      harvestDate: new Date().toISOString().slice(0, 10),
      state: 'Punjab',
      district: 'Ludhiana',
      perishable: false,
    };

    const draft = await call('/api/v1/listings', {
      method: 'POST',
      body: { ...listingBody, description: 'Best rate, contact 98765 43210' },
    });
    check(
      'listing description cannot carry a phone number',
      draft.status === 400 && draft.json.error?.code === 'CONTACT_INFO_BLOCKED',
      draft.json,
    );

    const solicitation = await call('/api/v1/listings', {
      method: 'POST',
      body: { ...listingBody, description: 'call me on that line for a better price' },
    });
    check(
      'listing description cannot solicit an off-platform call',
      solicitation.status === 400 &&
        solicitation.json.error?.code === 'CONTACT_INFO_BLOCKED',
      solicitation.json,
    );

    const clean = await call('/api/v1/listings', {
      method: 'POST',
      body: {
        ...listingBody,
        description: 'Grade A wheat, 100 quintal ready, 2400 per quintal, pickup from farm',
      },
    });
    check('normal listing copy still saves', clean.status === 201, clean.json);

    if (clean.json.data?.id) {
      const edit = await call(`/api/v1/listings/${clean.json.data.id}`, {
        method: 'PATCH',
        body: { description: 'edited — whatsapp me instead' },
      });
      check(
        'editing a listing cannot smuggle contact info back in',
        edit.status === 400 && edit.json.error?.code === 'CONTACT_INFO_BLOCKED',
        edit.json,
      );

      const removed = await call(`/api/v1/listings/${clean.json.data.id}`, { method: 'DELETE' });
      check('smoke listing cleaned up', removed.status === 200 || removed.status === 204, removed.json);
    }
  } finally {
    token = buyerToken;
  }
}

async function main(): Promise<void> {
  const login = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  token = login.json?.data?.accessToken ?? '';
  if (!token) {
    console.error('Login failed — is the demo data seeded?', login.status, login.json);
    process.exit(1);
  }
  console.log(`Logged in as ${EMAIL}\n`);

  console.log('Payment methods catalog');
  const methods = await call('/api/v1/payments/methods');
  check('200 with four methods', methods.status === 200 && methods.json.data?.length === 4, methods.json);
  check(
    'cod is the only non-escrow method',
    methods.json.data?.filter((m: any) => !m.escrow).map((m: any) => m.method).join() === 'cod',
    methods.json.data,
  );

  const orders = await call('/api/v1/orders?limit=20');
  const order = (orders.json.data ?? []).find((o: any) => o.status !== 'cancelled');
  if (!order) {
    console.error('No usable order for this buyer.');
    process.exit(1);
  }
  console.log(`\nOrder chat contact guard (order ${order.id.slice(0, 8)}, status ${order.status})`);

  const blocked = [
    'call me on 9876543210',
    'my number is 98765 43210',
    'nine eight seven six five four three two one zero',
    'mail me kabir@example.com',
    'pay me at farmer99@oksbi',
    'lets talk on whatsapp',
  ];
  for (const body of blocked) {
    const result = await call(`/api/v1/orders/${order.id}/messages`, { method: 'POST', body: { body } });
    check(
      `400 CONTACT_INFO_BLOCKED for "${body.slice(0, 34)}"`,
      result.status === 400 && result.json.error?.code === 'CONTACT_INFO_BLOCKED',
      result.json,
    );
  }

  const allowed = `Smoke check ${new Date().toISOString().slice(11, 19)} — 500 kg ready at 2400 per quintal, pickup tomorrow.`;
  const ok = await call(`/api/v1/orders/${order.id}/messages`, { method: 'POST', body: { body: allowed } });
  check('201 for normal trade talk', ok.status === 201, ok.json);

  console.log('\nPayment method validation');
  const badMethod = await call(`/api/v1/orders/${order.id}/payment`, {
    method: 'POST',
    body: { method: 'bitcoin' },
  });
  check('400 for unknown method', badMethod.status === 400, badMethod.json);

  const noMethod = await call(`/api/v1/orders/${order.id}/payment`, { method: 'POST', body: {} });
  check('400 when method is missing', noMethod.status === 400, noMethod.json);

  await escrowLifecycle();

  console.log(`\n${failures === 0 ? 'All smoke checks passed.' : `${failures} smoke check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
