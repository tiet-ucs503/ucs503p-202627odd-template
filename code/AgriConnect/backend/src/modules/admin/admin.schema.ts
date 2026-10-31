import { z } from 'zod';

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const adminUsersQuerySchema = z
  .object({
    role: z.enum(['FARMER', 'BUYER', 'ADMIN', 'AGRONOMIST']).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    suspended: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    ...pagination,
  })
  .strict();

export const adminUserIdParamsSchema = z.object({ id: z.uuid() }).strict();

export const suspendUserBodySchema = z
  .object({
    isSuspended: z.boolean(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const verifyUserBodySchema = z
  .object({
    verified: z.boolean(),
  })
  .strict();

export const moderateListingBodySchema = z
  .object({
    status: z.enum(['removed', 'active']),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const activityLogsQuerySchema = z
  .object({
    actorId: z.uuid().optional(),
    action: z.string().trim().min(1).max(80).optional(),
    ...pagination,
  })
  .strict();

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type SuspendUserInput = z.infer<typeof suspendUserBodySchema>;
export type VerifyUserInput = z.infer<typeof verifyUserBodySchema>;
export type ModerateListingInput = z.infer<typeof moderateListingBodySchema>;
export type ActivityLogsQuery = z.infer<typeof activityLogsQuerySchema>;
