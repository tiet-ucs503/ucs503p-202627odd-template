import { z } from 'zod';

export const buyerAlertBodySchema = z
  .object({
    crop: z.string().trim().min(1).max(80).nullable().optional(),
    state: z.string().trim().min(1).max(100).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export const alertIdParamsSchema = z.object({ id: z.uuid() }).strict();

export type BuyerAlertBody = z.infer<typeof buyerAlertBodySchema>;
