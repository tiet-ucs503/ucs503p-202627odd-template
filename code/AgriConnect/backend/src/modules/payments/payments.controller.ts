import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { applyGatewayWebhook, initOrderPayment, markPaymentHeld } from './payments.service.js';
import {
  ESCROW_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type ConfirmPaymentInput,
  type InitPaymentInput,
} from './payments.schema.js';
import {
  HANDLED_WEBHOOK_EVENTS,
  parseWebhookEvent,
  verifyWebhookSignature,
} from './payments.webhook.js';

function authenticatedUser(request: Request) {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}

function stringParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${name}`);
  }
  return value;
}

export const initOrderPaymentController = asyncHandler(async (request, response) => {
  const user = authenticatedUser(request);
  sendSuccess(
    response,
    await initOrderPayment(
      stringParam(request, 'id'),
      user.id,
      request.body as InitPaymentInput,
    ),
    201,
  );
});

export const confirmPaymentHeldController = asyncHandler(async (request, response) => {
  const user = authenticatedUser(request);
  sendSuccess(
    response,
    await markPaymentHeld(
      stringParam(request, 'id'),
      user.id,
      request.body as ConfirmPaymentInput,
    ),
  );
});

/**
 * Razorpay webhook. Unauthenticated by design — trust comes from the HMAC signature over
 * the raw body, which is why `express.raw` handles this path instead of `express.json`.
 *
 * Always answers 200 once the signature checks out: Razorpay retries any other status,
 * and a payload we choose not to act on is not a delivery failure.
 */
export const razorpayWebhookController = asyncHandler(async (request, response) => {
  const secret = getEnv().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError(503, 'NOT_READY', 'Payment webhooks are not configured');
  }

  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  const signature = request.header('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    logger.warn({ ip: request.ip }, 'Rejected Razorpay webhook with bad signature');
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid webhook signature');
  }

  const parsed = parseWebhookEvent(rawBody);
  if (!parsed) {
    sendSuccess(response, { received: true, handled: false, reason: 'Unreadable payload' });
    return;
  }

  if (!HANDLED_WEBHOOK_EVENTS.includes(parsed.event as (typeof HANDLED_WEBHOOK_EVENTS)[number])) {
    sendSuccess(response, { received: true, handled: false, reason: 'Event not handled' });
    return;
  }

  const result = await applyGatewayWebhook(parsed.event, parsed.entity);
  sendSuccess(response, { received: true, ...result });
});

export const listPaymentMethodsController = asyncHandler((_request, response) => {
  sendSuccess(
    response,
    PAYMENT_METHODS.map((method) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method],
      escrow: ESCROW_METHODS.includes(method),
    })),
  );
});
