import { AppError } from '../../common/app-error.js';
import { moneyString } from '../../common/decimal.js';
import { getEnv } from '../../config/env.js';
import { getPrismaClient } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import type { Payment, Prisma } from '../../generated/prisma/client.js';
import {
  PAYMENT_METHOD_LABELS,
  type ConfirmPaymentInput,
  type InitPaymentInput,
  type PaymentMethodValue,
} from './payments.schema.js';

/** Statuses where the money question is settled — re-initiating would be wrong. */
const TERMINAL_STATUSES = new Set(['released', 'refunded']);

/** Razorpay states where the buyer's money is actually committed to us. */
const COMMITTED_GATEWAY_STATUSES = new Set(['captured', 'authorized']);

/** The slice of Razorpay's payment entity we make decisions on. */
export interface GatewayPayment {
  id?: string;
  status?: string;
  order_id?: string | null;
  amount?: number;
  currency?: string;
  error_description?: string | null;
}

function toPaise(amount: Prisma.Decimal): number {
  return Math.round(Number(moneyString(amount)) * 100);
}

function serializePayment(payment: Payment) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    method: payment.method,
    methodLabel: payment.method ? PAYMENT_METHOD_LABELS[payment.method] : null,
    provider: payment.provider,
    status: payment.status,
    amount: moneyString(payment.amount),
    currency: payment.currency,
    heldAt: payment.heldAt?.toISOString() ?? null,
    releasedAt: payment.releasedAt?.toISOString() ?? null,
    refundedAt: payment.refundedAt?.toISOString() ?? null,
    failureReason: payment.failureReason,
  };
}

async function getOwnedOrder(orderId: string, buyerId: string) {
  const order = await getPrismaClient().order.findFirst({
    where: { id: orderId, buyerId },
    include: { payment: true },
  });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  return order;
}

function razorpayAuthHeader(): string {
  const env = getEnv();
  const credentials = `${env.RAZORPAY_KEY_ID ?? ''}:${env.RAZORPAY_KEY_SECRET ?? ''}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/** True when live checkout is possible: gateway-backed payment and keys present. */
function isGatewayLive(provider: string): boolean {
  const env = getEnv();
  return provider === 'razorpay' && Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

async function createRazorpayOrder(
  amount: string,
  orderId: string,
  method: PaymentMethodValue,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: razorpayAuthHeader(),
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100),
        currency: 'INR',
        receipt: orderId,
        notes: { orderId, method },
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: { description?: string };
    };

    if (!response.ok || !payload.id) {
      throw new AppError(
        502,
        'PAYMENT_UNAVAILABLE',
        payload.error?.description ?? 'Could not create Razorpay order',
      );
    }
    return payload.id;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'PAYMENT_UNAVAILABLE', 'Payment gateway is unreachable', {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reads a payment back from Razorpay. The browser tells us which payment id to look up,
 * but only this server-side read decides whether money actually moved.
 */
async function fetchRazorpayPayment(paymentId: string): Promise<GatewayPayment> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: { Authorization: razorpayAuthHeader() },
      },
    );

    const payload = (await response.json().catch(() => ({}))) as GatewayPayment & {
      error?: { description?: string };
    };

    if (response.status === 400 || response.status === 404) {
      // Razorpay does not know this id, so nothing was paid under it.
      throw new AppError(
        402,
        'PAYMENT_NOT_VERIFIED',
        'Razorpay does not recognise this payment reference',
      );
    }
    if (!response.ok || !payload.id) {
      throw new AppError(
        502,
        'PAYMENT_UNAVAILABLE',
        payload.error?.description ?? 'Could not read the payment from Razorpay',
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'PAYMENT_UNAVAILABLE', 'Payment gateway is unreachable', {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Decides whether a Razorpay payment entity may move our order into escrow.
 *
 * Pure so the rules can be tested without the gateway: the buyer's browser is never
 * trusted for status, amount, or which checkout the payment belongs to.
 */
export function checkGatewayPayment(
  gatewayPayment: GatewayPayment,
  expected: { orderRef: string; amountPaise: number },
): { ok: true } | { ok: false; reason: string } {
  const status = gatewayPayment.status ?? 'unknown';
  if (!COMMITTED_GATEWAY_STATUSES.has(status)) {
    return {
      ok: false,
      reason:
        gatewayPayment.error_description ??
        `Razorpay reports this payment as "${status}", so no money was captured`,
    };
  }
  if (gatewayPayment.order_id !== expected.orderRef) {
    return { ok: false, reason: 'This payment belongs to a different checkout' };
  }
  if (gatewayPayment.amount !== expected.amountPaise) {
    return {
      ok: false,
      reason: `Paid amount does not match the order total (expected ${String(expected.amountPaise)} paise)`,
    };
  }
  const currency = gatewayPayment.currency ?? 'INR';
  if (currency !== 'INR') {
    return { ok: false, reason: `Payment currency ${currency} is not INR` };
  }
  return { ok: true };
}

/**
 * Starts a payment for an order the buyer owns.
 *
 * UPI / card / net banking go through the gateway and land in escrow (`held`) so the
 * farmer is paid only once the order is fulfilled. Cash on delivery records the
 * intent and is collected in person, so it never enters escrow.
 */
export async function initOrderPayment(
  orderId: string,
  buyerId: string,
  input: InitPaymentInput,
) {
  const order = await getOwnedOrder(orderId, buyerId);
  if (order.status === 'cancelled') {
    throw new AppError(400, 'INVALID_REQUEST', 'Cannot pay for a cancelled order');
  }

  const existing = order.payment;
  if (existing && TERMINAL_STATUSES.has(existing.status)) {
    throw new AppError(
      409,
      'CONFLICT',
      `Payment is already ${existing.status} for this order`,
    );
  }
  if (existing?.status === 'held') {
    throw new AppError(409, 'CONFLICT', 'Payment is already held in escrow for this order');
  }

  const amount = moneyString(order.priceTotal);
  const method = input.method;
  const isCod = method === 'cod';
  const env = getEnv();
  const useGateway = !isCod && Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

  // Upsert keeps the unique orderId index from racing two concurrent checkouts.
  const payment = await getPrismaClient().payment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      amount: order.priceTotal,
      status: 'pending',
      method,
      provider: isCod ? 'cash' : 'razorpay',
      failureReason: null,
    },
    update: {
      amount: order.priceTotal,
      status: 'pending',
      method,
      provider: isCod ? 'cash' : 'razorpay',
      providerRef: null,
      failureReason: null,
    },
  });

  if (isCod) {
    return {
      ...serializePayment(payment),
      mode: 'cod' as const,
      message:
        'Cash on delivery selected. Pay the farmer when the produce arrives — escrow does not apply.',
    };
  }

  if (!useGateway) {
    return {
      ...serializePayment(payment),
      mode: 'mock' as const,
      message:
        'Razorpay keys are not configured. Payment is simulated — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for sandbox checkout.',
    };
  }

  const razorpayOrderId = await createRazorpayOrder(amount, order.id, method);
  const authorized = await getPrismaClient().payment.update({
    where: { id: payment.id },
    data: { providerRef: razorpayOrderId, status: 'authorized' },
  });

  return {
    ...serializePayment(authorized),
    mode: 'razorpay' as const,
    razorpayOrderId,
    keyId: env.RAZORPAY_KEY_ID,
  };
}

/** Writes the escrow hold. Shared by buyer confirmation and the Razorpay webhook. */
async function holdPayment(paymentId: string, providerRef: string | null) {
  return getPrismaClient().payment.update({
    where: { id: paymentId },
    data: {
      status: 'held',
      heldAt: new Date(),
      failureReason: null,
      ...(providerRef ? { providerRef } : {}),
    },
  });
}

/**
 * Moves a payment into escrow after the buyer finishes checkout. Idempotent for an
 * already-held payment so a double-tap in the UI does not fail the buyer.
 *
 * When Razorpay is live the payment is read back from the gateway first — the browser
 * reports which payment id to check, never whether it succeeded.
 */
export async function markPaymentHeld(
  orderId: string,
  buyerId: string,
  input: ConfirmPaymentInput,
) {
  const order = await getOwnedOrder(orderId, buyerId);
  const payment = order.payment;
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }
  if (payment.method === 'cod') {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Cash on delivery is collected on delivery and cannot be held in escrow',
    );
  }
  if (payment.status === 'held') {
    return serializePayment(payment);
  }
  if (TERMINAL_STATUSES.has(payment.status)) {
    throw new AppError(409, 'CONFLICT', `Payment is already ${payment.status}`);
  }
  if (payment.status === 'failed') {
    throw new AppError(400, 'INVALID_REQUEST', 'Payment failed — start a new payment');
  }

  if (isGatewayLive(payment.provider)) {
    if (!input.providerRef) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Razorpay payment id is required to confirm this payment',
        { fields: { providerRef: ['Razorpay payment id is required'] } },
      );
    }
    if (!payment.providerRef) {
      throw new AppError(
        409,
        'CONFLICT',
        'Payment was never started at the gateway — start a new payment',
      );
    }

    const gatewayPayment = await fetchRazorpayPayment(input.providerRef);
    const check = checkGatewayPayment(gatewayPayment, {
      orderRef: payment.providerRef,
      amountPaise: toPaise(payment.amount),
    });

    if (!check.ok) {
      await getPrismaClient().payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failureReason: check.reason },
      });
      logger.warn(
        { orderId, buyerId, providerRef: input.providerRef, reason: check.reason },
        'Rejected unverified payment confirmation',
      );
      throw new AppError(402, 'PAYMENT_NOT_VERIFIED', check.reason);
    }
  }

  const updated = await holdPayment(payment.id, input.providerRef ?? null);
  return serializePayment(updated);
}

/**
 * Applies a verified Razorpay webhook to our payment record.
 *
 * The signature is checked before we get here, so the payload is trusted to be from
 * Razorpay — but it is still matched against the stored checkout and amount so a replay
 * from another order cannot hold the wrong escrow. Callers always answer 200: Razorpay
 * retries anything else, and a mismatch is our problem to investigate, not theirs.
 */
export async function applyGatewayWebhook(
  event: string,
  entity: GatewayPayment & { notes?: { orderId?: string } | null },
): Promise<{ handled: boolean; reason: string }> {
  // Two ways in, because neither is guaranteed: `order_id` is always on a payment made
  // against a Razorpay order and matches the checkout we stored, while `notes.orderId`
  // is our own marker that Checkout options can override.
  const matchers: Prisma.PaymentWhereInput[] = [];
  if (entity.order_id) matchers.push({ providerRef: entity.order_id });
  if (entity.notes?.orderId) matchers.push({ orderId: entity.notes.orderId });
  if (matchers.length === 0) {
    return { handled: false, reason: 'Webhook payload has no order reference' };
  }

  const payment = await getPrismaClient().payment.findFirst({ where: { OR: matchers } });
  if (!payment) {
    // Money may have moved at the gateway with nothing here to attach it to, so this
    // needs to be visible in logs rather than swallowed by a 200.
    logger.warn(
      { event, paymentId: entity.id, razorpayOrderId: entity.order_id },
      'Razorpay webhook matched no payment',
    );
    return { handled: false, reason: 'No payment matches this webhook' };
  }
  const orderId = payment.orderId;

  if (event === 'payment.failed') {
    if (payment.status === 'held' || TERMINAL_STATUSES.has(payment.status)) {
      return { handled: false, reason: `Payment is already ${payment.status}` };
    }
    await getPrismaClient().payment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        failureReason: entity.error_description ?? 'Razorpay reported the payment as failed',
      },
    });
    logger.info({ orderId, event }, 'Payment marked failed from webhook');
    return { handled: true, reason: 'Payment marked failed' };
  }

  if (payment.status === 'held' || TERMINAL_STATUSES.has(payment.status)) {
    return { handled: false, reason: `Payment is already ${payment.status}` };
  }
  if (!payment.providerRef) {
    // Typically a checkout the buyer abandoned and restarted (or switched to COD) after
    // paying: worth a look, never worth holding escrow we cannot verify.
    logger.warn(
      { orderId, event, paymentId: entity.id, razorpayOrderId: entity.order_id },
      'Razorpay webhook for a payment with no stored checkout',
    );
    return { handled: false, reason: 'Payment has no gateway checkout to match' };
  }

  const check = checkGatewayPayment(entity, {
    orderRef: payment.providerRef,
    amountPaise: toPaise(payment.amount),
  });
  if (!check.ok) {
    logger.warn({ orderId, event, reason: check.reason }, 'Ignored mismatched payment webhook');
    return { handled: false, reason: check.reason };
  }

  await holdPayment(payment.id, entity.id ?? null);
  logger.info({ orderId, event }, 'Payment held in escrow from webhook');
  return { handled: true, reason: 'Payment held in escrow' };
}

/**
 * Refunds a held payment when an order is cancelled. Runs inside the cancellation
 * transaction so an order can never stay cancelled while still holding the buyer's money.
 */
export async function refundHeldPaymentForOrder(
  transaction: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const result = await transaction.payment.updateMany({
    where: { orderId, status: { in: ['pending', 'authorized', 'held'] } },
    data: { status: 'refunded', refundedAt: new Date() },
  });
  if (result.count > 0) {
    logger.info({ orderId }, 'Refunded payment after order cancellation');
  }
}
