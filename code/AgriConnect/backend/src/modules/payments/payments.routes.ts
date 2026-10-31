import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import {
  listPaymentMethodsController,
  razorpayWebhookController,
} from './payments.controller.js';

export const paymentsRouter = Router();

/**
 * Razorpay calls this with no JWT, so it is mounted above `requireAuth`. The raw-body
 * parser it needs is installed in `createApp` before `express.json`.
 */
paymentsRouter.post('/webhook', razorpayWebhookController);

paymentsRouter.use(requireAuth);

/** Catalog the checkout UI renders as the method picker. */
paymentsRouter.get('/methods', listPaymentMethodsController);
