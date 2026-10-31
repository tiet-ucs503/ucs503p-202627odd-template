import { z } from 'zod';

export const comparePricesBodySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.uuid(),
            crop: z.string().trim().min(1).max(80),
            state: z.string().trim().min(1).max(100),
            pricePerUnit: z.string().trim().min(1),
            unit: z.enum(['kg', 'quintal', 'ton']),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export type ComparePricesBody = z.infer<typeof comparePricesBodySchema>;
