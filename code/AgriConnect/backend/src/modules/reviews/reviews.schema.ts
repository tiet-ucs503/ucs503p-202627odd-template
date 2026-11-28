import { z } from 'zod';

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const createReviewBodySchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(500).optional(),
  })
  .strict();

export const listReviewsQuerySchema = z
  .object({
    ...paginationFields,
  })
  .strict();

export const userIdParamsSchema = z.object({ id: z.uuid() }).strict();

export type CreateReviewInput = z.infer<typeof createReviewBodySchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
