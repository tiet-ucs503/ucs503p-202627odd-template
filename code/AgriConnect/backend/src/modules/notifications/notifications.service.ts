import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { getPrismaClient } from '../../config/db.js';
import type { ListNotificationsQuery } from './notifications.schema.js';

/** `params` is only usable as a translation payload when it is a flat object. */
function serializeParams(
  params: Prisma.NotificationGetPayload<object>['params'],
): Record<string, string | number> | null {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) return null;
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] =>
      typeof entry[1] === 'string' || typeof entry[1] === 'number',
  );
  return Object.fromEntries(entries);
}

function serializeNotification(
  notification: Prisma.NotificationGetPayload<object>,
) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    params: serializeParams(notification.params),
    readAt: notification.readAt?.toISOString() ?? null,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unread ? { readAt: null } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    getPrismaClient().notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().notification.count({ where }),
  ]);

  return {
    notifications: rows.map(serializeNotification),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await getPrismaClient().notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  }

  const updated = await getPrismaClient().notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date() },
  });
  return serializeNotification(updated);
}

export async function markAllNotificationsRead(userId: string) {
  const result = await getPrismaClient().notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}
