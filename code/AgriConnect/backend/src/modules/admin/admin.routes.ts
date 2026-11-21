import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { validate } from '../../middleware/validate.js';
import {
  activityLogsController,
  analyticsController,
  listUsersController,
  moderateListingController,
  suspendUserController,
  verifyUserController,
} from './admin.controller.js';
import {
  activityLogsQuerySchema,
  adminUserIdParamsSchema,
  adminUsersQuerySchema,
  moderateListingBodySchema,
  suspendUserBodySchema,
  verifyUserBodySchema,
} from './admin.schema.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, roleGuard('ADMIN'));

adminRouter.get(
  '/users',
  validate({ query: adminUsersQuerySchema }),
  asyncHandler(listUsersController),
);

adminRouter.patch(
  '/users/:id/suspend',
  validate({ params: adminUserIdParamsSchema, body: suspendUserBodySchema }),
  asyncHandler(suspendUserController),
);

adminRouter.patch(
  '/users/:id/verify',
  validate({ params: adminUserIdParamsSchema, body: verifyUserBodySchema }),
  asyncHandler(verifyUserController),
);

adminRouter.patch(
  '/listings/:id/moderate',
  validate({ params: adminUserIdParamsSchema, body: moderateListingBodySchema }),
  asyncHandler(moderateListingController),
);

adminRouter.get(
  '/analytics',
  asyncHandler(analyticsController),
);

adminRouter.get(
  '/activity-logs',
  validate({ query: activityLogsQuerySchema }),
  asyncHandler(activityLogsController),
);
