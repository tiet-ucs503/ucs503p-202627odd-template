import { Router } from 'express';
import { optionalAuth } from '../../middleware/optional-auth.js';
import { requireActiveAccount } from '../../middleware/require-active-account.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { validate } from '../../middleware/validate.js';
import {
  createListingController,
  deleteListingController,
  deleteListingPhotoController,
  getListingController,
  listListingsController,
  listingPhotoUpload,
  updateListingController,
  uploadListingPhotosController,
} from './listings.controller.js';
import {
  createListingBodySchema,
  listingIdParamsSchema,
  listListingsQuerySchema,
  photoParamsSchema,
  updateListingBodySchema,
} from './listings.schema.js';

export const listingsRouter = Router();

listingsRouter.get(
  '/',
  optionalAuth,
  validate({ query: listListingsQuerySchema }),
  listListingsController,
);
listingsRouter.get(
  '/:id',
  optionalAuth,
  validate({ params: listingIdParamsSchema }),
  getListingController,
);
listingsRouter.post(
  '/',
  requireAuth,
  roleGuard('FARMER'),
  requireActiveAccount,
  validate({ body: createListingBodySchema }),
  createListingController,
);
listingsRouter.patch(
  '/:id',
  requireAuth,
  roleGuard('FARMER'),
  requireActiveAccount,
  validate({ params: listingIdParamsSchema, body: updateListingBodySchema }),
  updateListingController,
);
listingsRouter.delete(
  '/:id',
  requireAuth,
  roleGuard('FARMER'),
  requireActiveAccount,
  validate({ params: listingIdParamsSchema }),
  deleteListingController,
);
listingsRouter.post(
  '/:id/photos',
  requireAuth,
  roleGuard('FARMER'),
  requireActiveAccount,
  validate({ params: listingIdParamsSchema }),
  listingPhotoUpload,
  uploadListingPhotosController,
);
listingsRouter.delete(
  '/:id/photos/:photoId',
  requireAuth,
  roleGuard('FARMER', 'ADMIN'),
  requireActiveAccount,
  validate({ params: photoParamsSchema }),
  deleteListingPhotoController,
);
