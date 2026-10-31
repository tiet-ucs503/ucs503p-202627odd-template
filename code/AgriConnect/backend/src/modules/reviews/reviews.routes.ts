import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireActiveAccount } from '../../middleware/require-active-account.js';
import { validate } from '../../middleware/validate.js';
import { orderIdParamsSchema } from '../orders/orders.schema.js';
import {
  createReviewController,
  getMyOrderReviewController,
  listOrderReviewsController,
  listUserReviewsController,
} from './reviews.controller.js';
import {
  createReviewBodySchema,
  listReviewsQuerySchema,
  userIdParamsSchema,
} from './reviews.schema.js';

export const reviewsRouter = Router();

reviewsRouter.get(
  '/users/:id/reviews',
  validate({ params: userIdParamsSchema, query: listReviewsQuerySchema }),
  listUserReviewsController,
);

reviewsRouter.get(
  '/orders/:id/reviews',
  requireAuth,
  validate({ params: orderIdParamsSchema, query: listReviewsQuerySchema }),
  listOrderReviewsController,
);

reviewsRouter.get(
  '/orders/:id/reviews/me',
  requireAuth,
  validate({ params: orderIdParamsSchema }),
  getMyOrderReviewController,
);

reviewsRouter.post(
  '/orders/:id/reviews',
  requireAuth,
  requireActiveAccount,
  validate({ params: orderIdParamsSchema, body: createReviewBodySchema }),
  createReviewController,
);
