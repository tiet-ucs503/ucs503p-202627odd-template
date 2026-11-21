import { Router } from 'express';
import { requireActiveAccount } from '../../middleware/require-active-account.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { validate } from '../../middleware/validate.js';
import {
  acceptBidController,
  counterBidController,
  createBidController,
  getListingBidsController,
  listIncomingBidsController,
  listMyBidsController,
  rejectBidController,
  withdrawBidController,
} from './bids.controller.js';
import {
  bidIdParamsSchema,
  counterBidBodySchema,
  createBidBodySchema,
  listBidsQuerySchema,
  listingBidsParamsSchema,
  rejectBidBodySchema,
} from './bids.schema.js';

export const bidsRouter = Router();

bidsRouter.use(requireAuth);

bidsRouter.post(
  '/',
  roleGuard('BUYER'),
  requireActiveAccount,
  validate({ body: createBidBodySchema }),
  createBidController,
);

bidsRouter.get(
  '/my-bids',
  roleGuard('BUYER'),
  validate({ query: listBidsQuerySchema }),
  listMyBidsController,
);

bidsRouter.get(
  '/incoming',
  roleGuard('FARMER'),
  validate({ query: listBidsQuerySchema }),
  listIncomingBidsController,
);

bidsRouter.get(
  '/listing/:listingId',
  validate({ params: listingBidsParamsSchema }),
  getListingBidsController,
);

bidsRouter.post(
  '/:id/accept',
  roleGuard('FARMER', 'BUYER'),
  requireActiveAccount,
  validate({ params: bidIdParamsSchema }),
  acceptBidController,
);

bidsRouter.post(
  '/:id/reject',
  roleGuard('FARMER'),
  requireActiveAccount,
  validate({ params: bidIdParamsSchema, body: rejectBidBodySchema }),
  rejectBidController,
);

bidsRouter.post(
  '/:id/counter',
  roleGuard('FARMER'),
  requireActiveAccount,
  validate({ params: bidIdParamsSchema, body: counterBidBodySchema }),
  counterBidController,
);

bidsRouter.post(
  '/:id/withdraw',
  roleGuard('BUYER'),
  requireActiveAccount,
  validate({ params: bidIdParamsSchema }),
  withdrawBidController,
);
