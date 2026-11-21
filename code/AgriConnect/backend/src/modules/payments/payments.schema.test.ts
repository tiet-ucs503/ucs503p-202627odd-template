import { describe, expect, it } from 'vitest';
import {
  confirmPaymentBodySchema,
  ESCROW_METHODS,
  initPaymentBodySchema,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from './payments.schema.js';

describe('initPaymentBodySchema', () => {
  it.each(PAYMENT_METHODS)('accepts %s', (method) => {
    expect(initPaymentBodySchema.parse({ method })).toEqual({ method });
  });

  it('requires a method', () => {
    expect(initPaymentBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects an unknown method', () => {
    expect(initPaymentBodySchema.safeParse({ method: 'bitcoin' }).success).toBe(false);
  });

  it('rejects unknown keys so typos surface as 400s', () => {
    expect(
      initPaymentBodySchema.safeParse({ method: 'upi', amount: '1' }).success,
    ).toBe(false);
  });
});

describe('confirmPaymentBodySchema', () => {
  it('allows an empty body', () => {
    expect(confirmPaymentBodySchema.parse({})).toEqual({});
  });

  it('accepts a gateway payment reference', () => {
    expect(confirmPaymentBodySchema.parse({ providerRef: 'pay_123' })).toEqual({
      providerRef: 'pay_123',
    });
  });

  it('rejects a blank reference', () => {
    expect(confirmPaymentBodySchema.safeParse({ providerRef: '   ' }).success).toBe(false);
  });
});

describe('payment method catalog', () => {
  it('escrow covers every method except cash on delivery', () => {
    expect([...ESCROW_METHODS]).toEqual(['upi', 'card', 'netbanking']);
    expect(ESCROW_METHODS).not.toContain('cod');
  });

  it('labels every method for the checkout picker', () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABELS[method]).toBeTruthy();
    }
  });
});
