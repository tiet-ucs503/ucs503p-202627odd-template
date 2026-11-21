import { Prisma } from '../generated/prisma/client.js';
import type { NotificationType, PrismaClient } from '../generated/prisma/client.js';
import { getPrismaClient } from '../config/db.js';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

/**
 * `params` carries the values behind `title` / `body` (crop, quantity, statuses) so the
 * client can rebuild the sentence in the reader's language. `title` / `body` stay as the
 * English fallback for old rows and for email.
 */
export type NotificationParams = Record<string, string | number>;

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  params?: NotificationParams;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export function createNotification(
  input: CreateNotificationInput,
  database: DatabaseClient = getPrismaClient(),
) {
  return database.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      params: input.params ?? Prisma.JsonNull,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    },
  });
}

export function createNotifications(
  inputs: readonly CreateNotificationInput[],
  database: DatabaseClient = getPrismaClient(),
) {
  return database.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      params: input.params ?? Prisma.JsonNull,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    })),
  });
}
