import { describe, expect, it } from 'vitest';
import { createOrderBodySchema } from './orders.schema.js';

describe('createOrderBodySchema', () => {
  const base = {
    listingId: '00000000-0000-4000-8000-000000000001',
    deliveryMode: 'pickup' as const,
  };

  it('rejects zero quantity', () => {
    expect(
      createOrderBodySchema.safeParse({ ...base, quantity: '0' }).success,
    ).toBe(false);
  });

  it('accepts positive quantity', () => {
    const parsed = createOrderBodySchema.parse({ ...base, quantity: '50' });
    expect(parsed.quantity).toBe('50');
  });
});
