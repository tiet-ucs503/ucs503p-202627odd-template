import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import type { ListNotificationsQuery } from './notifications.schema.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service.js';

function userId(request: Request): string {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user.id;
}

function notificationId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'Notification id is required');
  }
  return id;
}

export const listNotificationsController = asyncHandler(async (request, response) => {
  const result = await listNotifications(
    userId(request),
    request.query as unknown as ListNotificationsQuery,
  );
  sendPaginated(response, result.notifications, result.pagination);
});

export const markNotificationReadController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await markNotificationRead(userId(request), notificationId(request)),
  );
});

export const markAllNotificationsReadController = asyncHandler(async (request, response) => {
  sendSuccess(response, await markAllNotificationsRead(userId(request)));
});
