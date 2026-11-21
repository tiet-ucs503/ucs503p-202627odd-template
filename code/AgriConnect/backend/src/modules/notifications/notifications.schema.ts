import { z } from 'zod';

export const listNotificationsQuerySchema = z
  .object({
    unread: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const notificationIdParamsSchema = z.object({ id: z.uuid() }).strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
