/**
 * Razorpay webhook verification.
 *
 * The webhook is the only payment signal that survives a buyer closing the tab
 * mid-checkout, so it must be trusted — but anyone can POST to a public URL. Razorpay
 * signs the exact bytes it sends with the shared webhook secret, so we HMAC the raw body
 * and compare digests before the payload is allowed anywhere near an escrow hold.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GatewayPayment } from './payments.service.js';

/** Events we act on. Anything else is acknowledged and ignored. */
export const HANDLED_WEBHOOK_EVENTS = ['payment.captured', 'payment.failed'] as const;

export interface WebhookEvent {
  event: string;
  entity: GatewayPayment & { notes?: { orderId?: string } | null };
}

/**
 * True when the body was signed with our webhook secret.
 *
 * Compared with `timingSafeEqual` so a wrong signature cannot be discovered one byte at
 * a time. Digests are fixed length, so a length mismatch already means a forgery.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }

  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

/** Pulls the event name and payment entity out of a Razorpay webhook body. */
export function parseWebhookEvent(rawBody: Buffer | string): WebhookEvent | null {
  const text = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as {
    event?: unknown;
    payload?: { payment?: { entity?: unknown } };
  };

  const entity = body.payload?.payment?.entity;
  if (typeof body.event !== 'string' || typeof entity !== 'object' || entity === null) {
    return null;
  }

  return { event: body.event, entity };
}
