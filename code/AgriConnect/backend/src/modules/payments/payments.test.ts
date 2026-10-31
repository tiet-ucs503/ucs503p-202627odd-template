import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkGatewayPayment, type GatewayPayment } from './payments.service.js';
import { parseWebhookEvent, verifyWebhookSignature } from './payments.webhook.js';

/** A ₹2,500 order paid in full against the checkout we created. */
const EXPECTED = { orderRef: 'order_ABC123', amountPaise: 250_000 };

type GatewayPaymentWithNotes = GatewayPayment & { notes?: { orderId?: string } };

function captured(overrides: GatewayPaymentWithNotes = {}): GatewayPaymentWithNotes {
  return {
    id: 'pay_XYZ789',
    status: 'captured',
    order_id: EXPECTED.orderRef,
    amount: EXPECTED.amountPaise,
    currency: 'INR',
    ...overrides,
  };
}

describe('checkGatewayPayment', () => {
  it('accepts a captured payment for the right checkout and amount', () => {
    expect(checkGatewayPayment(captured(), EXPECTED)).toEqual({ ok: true });
  });

  it('accepts an authorized payment that has not settled yet', () => {
    expect(checkGatewayPayment(captured({ status: 'authorized' }), EXPECTED)).toEqual({
      ok: true,
    });
  });

  it.each(['created', 'failed', 'refunded', 'unknown'])(
    'rejects a payment in %s state',
    (status) => {
      const result = checkGatewayPayment(captured({ status }), EXPECTED);
      expect(result.ok).toBe(false);
    },
  );

  it('rejects a payment with no status at all', () => {
    const result = checkGatewayPayment({ id: 'pay_1' }, EXPECTED);
    expect(result).toMatchObject({ ok: false });
  });

  it('prefers the gateway failure description when the payment did not go through', () => {
    const result = checkGatewayPayment(
      captured({ status: 'failed', error_description: 'Card declined by issuer' }),
      EXPECTED,
    );
    expect(result).toEqual({ ok: false, reason: 'Card declined by issuer' });
  });

  it('rejects a real payment made against a different checkout', () => {
    const result = checkGatewayPayment(captured({ order_id: 'order_SOMEONE_ELSE' }), EXPECTED);
    expect(result).toEqual({ ok: false, reason: 'This payment belongs to a different checkout' });
  });

  it('rejects an underpayment', () => {
    const result = checkGatewayPayment(captured({ amount: 100 }), EXPECTED);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.reason).toContain('250000 paise');
  });

  it('rejects a payment in another currency', () => {
    const result = checkGatewayPayment(captured({ currency: 'USD' }), EXPECTED);
    expect(result).toEqual({ ok: false, reason: 'Payment currency USD is not INR' });
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test_secret';
  const body = JSON.stringify({ event: 'payment.captured' });
  const sign = (payload: string, key: string) =>
    createHmac('sha256', key).update(payload).digest('hex');

  it('accepts a body signed with the webhook secret', () => {
    expect(verifyWebhookSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it('accepts a raw Buffer body', () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body, secret), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const signature = sign(body, secret);
    const tampered = JSON.stringify({ event: 'payment.captured', extra: 'injected' });
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'whsec_attacker'), secret)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false);
  });

  it('rejects a non-hex or truncated signature', () => {
    expect(verifyWebhookSignature(body, 'not-a-signature', secret)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, secret).slice(0, 32), secret)).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(verifyWebhookSignature(body, sign(body, ''), '')).toBe(false);
  });
});

describe('parseWebhookEvent', () => {
  it('pulls the event name and payment entity out of a Razorpay body', () => {
    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: captured({ notes: { orderId: 'order-uuid' } }) } },
    });

    expect(parseWebhookEvent(raw)).toMatchObject({
      event: 'payment.captured',
      entity: { id: 'pay_XYZ789', notes: { orderId: 'order-uuid' } },
    });
  });

  it('returns null for a body that is not JSON', () => {
    expect(parseWebhookEvent('<html>error</html>')).toBeNull();
  });

  it('returns null when the payment entity is missing', () => {
    expect(parseWebhookEvent(JSON.stringify({ event: 'payment.captured' }))).toBeNull();
  });

  it('returns null when the event name is missing', () => {
    const raw = JSON.stringify({ payload: { payment: { entity: captured() } } });
    expect(parseWebhookEvent(raw)).toBeNull();
  });
});
