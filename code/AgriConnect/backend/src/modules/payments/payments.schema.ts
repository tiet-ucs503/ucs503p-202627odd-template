import { z } from 'zod';

export const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'cod'] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

/** Cash on delivery skips the gateway, so it never enters escrow. */
export const ESCROW_METHODS: readonly PaymentMethodValue[] = ['upi', 'card', 'netbanking'];

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const initPaymentBodySchema = z
  .object({
    method: paymentMethodSchema,
  })
  .strict();

export const confirmPaymentBodySchema = z
  .object({
    providerRef: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export type InitPaymentInput = z.infer<typeof initPaymentBodySchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentBodySchema>;

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethodValue, string>> = {
  upi: 'UPI',
  card: 'Credit / debit card',
  netbanking: 'Net banking',
  cod: 'Cash on delivery',
};
