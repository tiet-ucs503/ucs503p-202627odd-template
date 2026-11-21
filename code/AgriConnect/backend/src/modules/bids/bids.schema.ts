import { z } from 'zod';
import { BidStatus } from '../../generated/prisma/client.js';

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const createBidBodySchema = z
  .object({
    listingId: z.uuid(),
    pricePerUnit: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,2})?$/, 'pricePerUnit must be a valid decimal')
      .refine((value) => Number(value) > 0, 'pricePerUnit must be greater than zero'),
    quantity: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,3})?$/, 'quantity must be a valid number')
      .refine((value) => Number(value) > 0, 'quantity must be greater than zero'),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const counterBidBodySchema = z
  .object({
    counterPrice: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,2})?$/, 'counterPrice must be a valid decimal')
      .refine((value) => Number(value) > 0, 'counterPrice must be greater than zero'),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const rejectBidBodySchema = z
  .object({
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listBidsQuerySchema = z
  .object({
    status: z.enum(BidStatus).optional(),
    ...paginationFields,
  })
  .strict();

export const bidIdParamsSchema = z.object({ id: z.uuid() }).strict();
export const listingBidsParamsSchema = z.object({ listingId: z.uuid() }).strict();

export type CreateBidInput = z.infer<typeof createBidBodySchema>;
export type CounterBidInput = z.infer<typeof counterBidBodySchema>;
export type RejectBidInput = z.infer<typeof rejectBidBodySchema>;
export type ListBidsQuery = z.infer<typeof listBidsQuerySchema>;
