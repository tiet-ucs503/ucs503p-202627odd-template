/**
 * Route-level tests for the Razorpay webhook.
 *
 * The unit tests in `payments.test.ts` cover the signature maths; these cover the wiring
 * that unit tests cannot see — that `express.raw` hands the handler the exact bytes
 * Razorpay signed, that the route bypasses `requireAuth`, and that a rejected delivery
 * still uses the standard error envelope. Payloads here never reach the database.
 */

import { createHmac } from 'node:crypto';
import type { Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { disconnectDatabase } from '../src/config/db.js';
import { resetEnvForTests } from '../src/config/env.js';

const SECRET = 'whsec_route_test';
const WEBHOOK_PATH = '/api/v1/payments/webhook';

interface WebhookBody {
  success: boolean;
  data?: { received?: boolean; handled?: boolean; reason?: string };
  error?: { code: string };
}

function body(response: Response): WebhookBody {
  return response.body as WebhookBody;
}

function sign(raw: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/** A signed delivery for an event we acknowledge but do not act on — no DB access. */
function unhandledEvent(): string {
  return JSON.stringify({
    event: 'payment.authorized',
    payload: { payment: { entity: { id: 'pay_route', status: 'authorized' } } },
  });
}

function post(raw: string, signature?: string) {
  const pending = request(app).post(WEBHOOK_PATH).set('Content-Type', 'application/json');
  if (signature !== undefined) {
    pending.set('x-razorpay-signature', signature);
  }
  return pending.send(raw);
}

beforeAll(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  resetEnvForTests();
});

afterAll(async () => {
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  resetEnvForTests();
  await disconnectDatabase();
});

describe('POST /api/v1/payments/webhook', () => {
  it('accepts a correctly signed delivery without any bearer token', async () => {
    const raw = unhandledEvent();
    const response = await post(raw, sign(raw));

    expect(response.status).toBe(200);
    expect(body(response)).toMatchObject({
      success: true,
      data: { received: true, handled: false },
    });
  });

  it('verifies the signature over the exact bytes, so raw body parsing must survive', async () => {
    // Signed with the same JSON re-serialized differently: identical object, other bytes.
    const signedBytes = '{"event":"payment.authorized","payload":{"payment":{"entity":{}}}}';
    const sentBytes = '{ "event": "payment.authorized", "payload": { "payment": { "entity": {} } } }';

    const response = await post(sentBytes, sign(signedBytes));

    expect(response.status).toBe(401);
    expect(body(response).error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects a missing signature header', async () => {
    const response = await post(unhandledEvent());

    expect(response.status).toBe(401);
    expect(body(response).error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects a signature made with another secret', async () => {
    const raw = unhandledEvent();
    const response = await post(raw, sign(raw, 'whsec_attacker'));

    expect(response.status).toBe(401);
    expect(body(response).error?.code).toBe('UNAUTHORIZED');
  });

  it('acknowledges a signed but unreadable payload instead of retrying forever', async () => {
    const raw = 'not json at all';
    const response = await post(raw, sign(raw));

    expect(response.status).toBe(200);
    expect(body(response).data).toMatchObject({ received: true, handled: false });
  });

  it('reports 503 when no webhook secret is configured', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    resetEnvForTests();

    try {
      const raw = unhandledEvent();
      const response = await post(raw, sign(raw));

      expect(response.status).toBe(503);
      expect(body(response).error?.code).toBe('NOT_READY');
    } finally {
      process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
      resetEnvForTests();
    }
  });
});
