import { z } from 'zod';

export const mandiPricesQuerySchema = z
  .object({
    state: z.string().trim().min(1).max(100).default('Punjab'),
    commodity: z.string().trim().min(1).max(80),
    market: z.string().trim().min(1).max(120).optional(),
    latestOnly: z
      .preprocess((value) => {
        if (value === 'false' || value === false) return false;
        if (value === 'true' || value === true) return true;
        return undefined;
      }, z.boolean().optional()),
  })
  .strict();

export const mandiHistoryQuerySchema = z
  .object({
    state: z.string().trim().min(1).max(100).default('Punjab'),
    commodity: z.string().trim().min(1).max(80),
    market: z.string().trim().min(1).max(120).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export const mandiStateQuerySchema = z
  .object({
    state: z.string().trim().min(1).max(100),
  })
  .strict();

export const mandiCommoditiesQuerySchema = z
  .object({
    state: z.string().trim().min(1).max(100),
  })
  .strict();

export type MandiCommoditiesQuery = z.infer<typeof mandiCommoditiesQuerySchema>;
export type MandiPricesQuery = z.infer<typeof mandiPricesQuerySchema>;
export type MandiHistoryQuery = z.infer<typeof mandiHistoryQuerySchema>;
