import { z } from 'zod';
import { DeliveryMode, OrderStatus } from '../../generated/prisma/client.js';

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const createOrderBodySchema = z
  .object({
    listingId: z.uuid(),
    quantity: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,3})?$/)
      .refine((value) => Number(value) > 0, 'quantity must be greater than zero'),
    deliveryMode: z.enum(DeliveryMode),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const listOrdersQuerySchema = z
  .object({
    status: z.enum(OrderStatus).optional(),
    ...paginationFields,
  })
  .strict();

export const orderIdParamsSchema = z.object({ id: z.uuid() }).strict();

export const updateOrderStatusBodySchema = z
  .object({
    status: z.enum(OrderStatus),
    cancellationReason: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'cancelled' && !value.cancellationReason) {
      context.addIssue({
        code: 'custom',
        path: ['cancellationReason'],
        message: 'Cancellation reason is required',
      });
    }
    if (value.status !== 'cancelled' && value.cancellationReason != null) {
      context.addIssue({
        code: 'custom',
        path: ['cancellationReason'],
        message: 'Cancellation reason is only valid when cancelling',
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderBodySchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusBodySchema>;
