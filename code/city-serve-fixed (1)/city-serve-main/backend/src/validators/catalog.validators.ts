import { z } from "zod";

export const createProductSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(2).max(150),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  price: z.number().positive(),
  unit: z.string().min(1),
  stockQty: z.number().int().nonnegative().default(999),
  qualityTags: z.array(z.string()).optional(),
});

export const createServiceSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(2).max(150),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  price: z.number().positive(),
  priceType: z.enum(["fixed", "starting_at", "visit_charge"]).default("fixed"),
  durationMinutes: z.number().int().positive().default(60),
});
