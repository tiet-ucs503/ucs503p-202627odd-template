import { Router } from 'express';
import { requireActiveAccount } from '../../middleware/require-active-account.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { validate } from '../../middleware/validate.js';
import {
  deleteMeController,
  exportMeController,
  getBuyerProfileController,
  getFarmerProfileController,
  getMeController,
  getPublicFarmerController,
  updateBuyerProfileController,
  updateFarmerProfileController,
  updateMeController,
} from './users.controller.js';
import {
  deleteMeSchema,
  publicUserParamsSchema,
  updateBuyerProfileSchema,
  updateFarmerProfileSchema,
  updateMeSchema,
} from './users.schema.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, getMeController);
usersRouter.patch(
  '/me',
  requireAuth,
  requireActiveAccount,
  validate({ body: updateMeSchema }),
  updateMeController,
);
usersRouter.get(
  '/me/farmer-profile',
  requireAuth,
  roleGuard('FARMER'),
  getFarmerProfileController,
);
usersRouter.patch(
  '/me/farmer-profile',
  requireAuth,
  roleGuard('FARMER'),
  requireActiveAccount,
  validate({ body: updateFarmerProfileSchema }),
  updateFarmerProfileController,
);
usersRouter.get(
  '/me/buyer-profile',
  requireAuth,
  roleGuard('BUYER'),
  getBuyerProfileController,
);
usersRouter.patch(
  '/me/buyer-profile',
  requireAuth,
  roleGuard('BUYER'),
  requireActiveAccount,
  validate({ body: updateBuyerProfileSchema }),
  updateBuyerProfileController,
);
usersRouter.get('/me/export', requireAuth, exportMeController);
usersRouter.delete(
  '/me',
  requireAuth,
  roleGuard('FARMER', 'BUYER'),
  validate({ body: deleteMeSchema }),
  deleteMeController,
);
usersRouter.get(
  '/:id/public',
  validate({ params: publicUserParamsSchema }),
  getPublicFarmerController,
);
