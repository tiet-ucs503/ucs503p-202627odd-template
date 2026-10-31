import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from './notifications.controller.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from './notifications.schema.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  listNotificationsController,
);
notificationsRouter.post('/read-all', markAllNotificationsReadController);
notificationsRouter.patch(
  '/:id/read',
  validate({ params: notificationIdParamsSchema }),
  markNotificationReadController,
);
