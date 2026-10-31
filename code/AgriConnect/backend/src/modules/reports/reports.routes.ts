import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { requireActiveAccount } from '../../middleware/require-active-account.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { validate } from '../../middleware/validate.js';
import { getMyReportController } from './reports.controller.js';
import { reportQuerySchema } from './reports.schema.js';

export const reportsRouter = Router();

reportsRouter.get(
  '/me',
  requireAuth,
  requireActiveAccount,
  roleGuard('FARMER', 'BUYER'),
  validate({ query: reportQuerySchema }),
  asyncHandler(getMyReportController),
);
