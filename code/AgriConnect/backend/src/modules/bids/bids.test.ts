import { describe, expect, it } from 'vitest';
import { assertNoContactInfo } from '../../common/contact-guard.js';
import {
  counterBidBodySchema,
  createBidBodySchema,
  listBidsQuerySchema,
  rejectBidBodySchema,
} from './bids.schema.js';

describe('bids schema validation', () => {
  const validBid = {
    listingId: '00000000-0000-4000-8000-000000000001',
    pricePerUnit: '2200.00',
    quantity: '25.000',
    notes: 'Can arrange truck pickup on Tuesday morning',
  };

  it('accepts valid bid input', () => {
    const parsed = createBidBodySchema.parse(validBid);
    expect(parsed.pricePerUnit).toBe('2200.00');
    expect(parsed.quantity).toBe('25.000');
    expect(parsed.notes).toBe('Can arrange truck pickup on Tuesday morning');
  });

  it('rejects zero or negative bid price', () => {
    expect(
      createBidBodySchema.safeParse({ ...validBid, pricePerUnit: '0' }).success,
    ).toBe(false);
    expect(
      createBidBodySchema.safeParse({ ...validBid, pricePerUnit: '-100' }).success,
    ).toBe(false);
  });

  it('rejects zero or negative quantity', () => {
    expect(
      createBidBodySchema.safeParse({ ...validBid, quantity: '0' }).success,
    ).toBe(false);
  });

  it('rejects invalid decimal precision', () => {
    expect(
      createBidBodySchema.safeParse({ ...validBid, pricePerUnit: '2200.555' }).success,
    ).toBe(false);
  });

  it('validates counter-offer schema', () => {
    const parsed = counterBidBodySchema.parse({
      counterPrice: '2350.00',
      notes: 'Final price given high transport cost',
    });
    expect(parsed.counterPrice).toBe('2350.00');
    expect(counterBidBodySchema.safeParse({ counterPrice: '0' }).success).toBe(false);
  });

  it('validates reject bid schema', () => {
    const parsed = rejectBidBodySchema.parse({
      rejectionReason: 'Already received full asking price locally',
    });
    expect(parsed.rejectionReason).toBe('Already received full asking price locally');
  });

  it('parses list bids query with defaults', () => {
    const parsed = listBidsQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.status).toBeUndefined();
  });
});

describe('bids contact-guard anti-disintermediation', () => {
  it('permits clean agricultural notes', () => {
    expect(() =>
      assertNoContactInfo('Need 20 quintals delivered to Azadpur Mandi warehouse', 'notes'),
    ).not.toThrow();
  });

  it('blocks Indian mobile phone numbers in bid notes', () => {
    expect(() =>
      assertNoContactInfo('Call me at 9876543210 to discuss cash deal', 'notes'),
    ).toThrow();
  });

  it('blocks obfuscated phone numbers in bid notes', () => {
    expect(() =>
      assertNoContactInfo('whatsapp on 9 8 7 6 5 4 3 2 1 0', 'notes'),
    ).toThrow();
  });

  it('blocks email addresses in bid notes', () => {
    expect(() =>
      assertNoContactInfo('reach me at buyer@graincorp.in', 'notes'),
    ).toThrow();
  });
});
