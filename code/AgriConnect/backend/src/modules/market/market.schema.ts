import { z } from 'zod';

export const priceTrendQuerySchema = z
  .object({
    crop: z.string().trim().min(1).max(80).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    days: z.coerce.number().int().min(1).max(365).default(90),
    limit: z.coerce.number().int().min(1).max(500).default(120),
  })
  .strict();

export type PriceTrendQuery = z.infer<typeof priceTrendQuerySchema>;
