import { z } from 'zod';

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};

export const listMessagesQuerySchema = z
  .object({
    ...paginationFields,
  })
  .strict();

export const createMessageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type CreateMessageInput = z.infer<typeof createMessageBodySchema>;
