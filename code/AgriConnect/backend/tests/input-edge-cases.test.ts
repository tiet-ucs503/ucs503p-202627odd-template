import { describe, expect, it } from 'vitest';
import { scanForContactInfo } from '../src/common/contact-guard.js';
import {
  createListingBodySchema,
  listListingsQuerySchema,
  updateListingBodySchema,
} from '../src/modules/listings/listings.schema.js';
import {
  createOrderBodySchema,
  updateOrderStatusBodySchema,
} from '../src/modules/orders/orders.schema.js';
import {
  createBidBodySchema,
  counterBidBodySchema,
} from '../src/modules/bids/bids.schema.js';

describe('Senior Developer Edge-Case Audit: Backend Input Schemas & Guardrails', () => {
  describe('Listing Schema Edge Cases', () => {
    const baseListing = {
      crop: 'Wheat',
      category: 'grains',
      quantity: '100.000',
      unit: 'quintal',
      pricePerUnit: '2400.00',
      harvestDate: '2026-05-15',
      state: 'Punjab',
      district: 'Ludhiana',
      minimumOrderQuantity: '5.000',
      perishable: false,
    };

    it('rejects zero or negative quantities', () => {
      expect(createListingBodySchema.safeParse({ ...baseListing, quantity: '0' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, quantity: '-10' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, quantity: '0.000' }).success).toBe(false);
    });

    it('rejects quantities with more than 3 decimal places', () => {
      expect(createListingBodySchema.safeParse({ ...baseListing, quantity: '100.1234' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, quantity: '5.9999' }).success).toBe(false);
    });

    it('rejects minimum order quantity exceeding available quantity', () => {
      const res = createListingBodySchema.safeParse({
        ...baseListing,
        quantity: '50.000',
        minimumOrderQuantity: '50.001',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toMatch(/cannot exceed quantity/i);
      }
    });

    it('validates harvestDate format and enforces calendar bounds', () => {
      // Invalid format
      expect(createListingBodySchema.safeParse({ ...baseListing, harvestDate: '15-05-2026' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, harvestDate: '2026/05/15' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, harvestDate: 'tomorrow' }).success).toBe(false);

      // Non-existent calendar dates (leap year / month bounds)
      expect(createListingBodySchema.safeParse({ ...baseListing, harvestDate: '2026-02-31' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, harvestDate: '2026-04-31' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, harvestDate: '2026-13-01' }).success).toBe(false);

      // More than 2 years into future
      expect(createListingBodySchema.safeParse({ ...baseListing, harvestDate: '2029-01-01' }).success).toBe(false);
    });

    it('rejects units and statuses outside permitted enums', () => {
      expect(createListingBodySchema.safeParse({ ...baseListing, unit: 'lbs' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, unit: 'grams' }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, status: 'archived' }).success).toBe(false);
    });

    it('enforces maximum length boundaries on text fields', () => {
      expect(createListingBodySchema.safeParse({ ...baseListing, crop: 'A'.repeat(81) }).success).toBe(false);
      expect(createListingBodySchema.safeParse({ ...baseListing, description: 'A'.repeat(2001) }).success).toBe(false);
    });

    it('rejects empty patches in updateListingBodySchema', () => {
      expect(updateListingBodySchema.safeParse({}).success).toBe(false);
    });
  });

  describe('Order Schema Edge Cases', () => {
    const validOrder = {
      listingId: 'd1111111-1111-4111-8111-111111111111',
      quantity: '10.000',
      deliveryMode: 'delivery',
      notes: 'Please call when arriving at warehouse.',
    };

    it('rejects malformed non-UUID listingId', () => {
      expect(createOrderBodySchema.safeParse({ ...validOrder, listingId: 'not-a-uuid' }).success).toBe(false);
      expect(createOrderBodySchema.safeParse({ ...validOrder, listingId: '12345' }).success).toBe(false);
      expect(createOrderBodySchema.safeParse({ ...validOrder, listingId: '' }).success).toBe(false);
    });

    it('rejects zero or negative order quantities', () => {
      expect(createOrderBodySchema.safeParse({ ...validOrder, quantity: '0' }).success).toBe(false);
      expect(createOrderBodySchema.safeParse({ ...validOrder, quantity: '-5' }).success).toBe(false);
    });

    it('rejects unpermitted delivery modes', () => {
      expect(createOrderBodySchema.safeParse({ ...validOrder, deliveryMode: 'drone' }).success).toBe(false);
      expect(createOrderBodySchema.safeParse({ ...validOrder, deliveryMode: 'air_freight' }).success).toBe(false);
    });

    it('enforces order cancellation invariants', () => {
      // Status cancelled MUST provide a cancellationReason
      const cancelWithoutReason = updateOrderStatusBodySchema.safeParse({
        status: 'cancelled',
      });
      expect(cancelWithoutReason.success).toBe(false);

      // Status accepted MUST NOT provide a cancellationReason
      const acceptWithReason = updateOrderStatusBodySchema.safeParse({
        status: 'accepted',
        cancellationReason: 'Not needed',
      });
      expect(acceptWithReason.success).toBe(false);

      // Valid cancellation
      const validCancel = updateOrderStatusBodySchema.safeParse({
        status: 'cancelled',
        cancellationReason: 'Buyer truck broke down.',
      });
      expect(validCancel.success).toBe(true);
    });
  });

  describe('Marketplace Query Filters Edge Cases', () => {
    it('parses valid numeric query strings and clamps boundaries', () => {
      const parsed = listListingsQuerySchema.parse({
        page: '1',
        limit: '50',
      });
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(50);
    });

    it('rejects limits exceeding 100', () => {
      expect(listListingsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
      expect(listListingsQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
    });

    it('rejects zero or negative page numbers', () => {
      expect(listListingsQuerySchema.safeParse({ page: '0' }).success).toBe(false);
      expect(listListingsQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    });
  });

  describe('Anti-Disintermediation Contact Guard Edge Cases', () => {
    it('blocks disguised 10-digit phone numbers across formats', () => {
      expect(scanForContactInfo('Contact me at 9876543210').violations).toContain('phone');
      expect(scanForContactInfo('call +91 98765 43210 immediately').violations).toContain('phone');
      expect(scanForContactInfo('my no is 9 8 7 6 5 4 3 2 1 0').violations).toContain('phone');
      expect(scanForContactInfo('dial 9876.543.210').violations).toContain('phone');
      expect(scanForContactInfo('call 9876-543-210').violations).toContain('phone');
    });

    it('blocks spelled-out English phone numbers', () => {
      expect(
        scanForContactInfo('my number is nine eight seven six five four three two one zero').violations,
      ).toContain('phone');
    });

    it('blocks email addresses and UPI handles', () => {
      expect(scanForContactInfo('email me at seller@example.com').violations).toContain('email');
      expect(scanForContactInfo('pay me at farmer@oksbi').violations).toContain('upi');
      expect(scanForContactInfo('send to trader@paytm').violations).toContain('upi');
      expect(scanForContactInfo('gpay me on aman@upi').violations).toContain('upi');
    });

    it('blocks external communication solicitation', () => {
      expect(scanForContactInfo('message me on whatsapp for better rate').violations).toContain('off_platform');
      expect(scanForContactInfo('join my telegram group').violations).toContain('off_platform');
    });

    it('allows clean legitimate trade messaging without false alarms', () => {
      expect(scanForContactInfo('Truck will arrive at Pakhowal yard at 8 AM with gate pass.').violations).toEqual([]);
      expect(scanForContactInfo('50 quintals wheat moisture certified at 12%.').violations).toEqual([]);
      expect(scanForContactInfo('Payment of Rs 1,10,000 confirmed for Cash on Delivery.').violations).toEqual([]);
    });
  });

  describe('Bidding Schema Edge Cases', () => {
    const validBid = {
      pricePerUnit: '2200.00',
      quantity: '20.000',
      unit: 'quintal',
      notes: 'Can collect this weekend.',
    };

    it('rejects zero or negative bid prices', () => {
      expect(createBidBodySchema.safeParse({ ...validBid, pricePerUnit: '0' }).success).toBe(false);
      expect(createBidBodySchema.safeParse({ ...validBid, pricePerUnit: '-100' }).success).toBe(false);
    });

    it('rejects zero or negative bid quantities', () => {
      expect(createBidBodySchema.safeParse({ ...validBid, quantity: '0' }).success).toBe(false);
      expect(createBidBodySchema.safeParse({ ...validBid, quantity: '-5' }).success).toBe(false);
    });

    it('validates counter-offer price constraints', () => {
      expect(counterBidBodySchema.safeParse({ counterPrice: '2350.00' }).success).toBe(true);
      expect(counterBidBodySchema.safeParse({ counterPrice: '0' }).success).toBe(false);
      expect(counterBidBodySchema.safeParse({ counterPrice: '-50' }).success).toBe(false);
      expect(counterBidBodySchema.safeParse({ counterPrice: '2350.001' }).success).toBe(false);
    });
  });
});
