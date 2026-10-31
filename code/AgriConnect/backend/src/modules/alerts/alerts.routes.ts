import { Router } from 'express';
import { requireActiveAccount } from '../../middleware/require-active-account.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { validate } from '../../middleware/validate.js';
import {
  createAlertController,
  deleteAlertController,
  listMyAlertsController,
} from './alerts.controller.js';
import { alertIdParamsSchema, buyerAlertBodySchema } from './alerts.schema.js';

export const alertsRouter = Router();

alertsRouter.use(requireAuth, roleGuard('BUYER'));

alertsRouter.get('/', listMyAlertsController);
alertsRouter.post(
  '/',
  requireActiveAccount,
  validate({ body: buyerAlertBodySchema }),
  createAlertController,
);
alertsRouter.delete(
  '/:id',
  requireActiveAccount,
  validate({ params: alertIdParamsSchema }),
  deleteAlertController,
);
