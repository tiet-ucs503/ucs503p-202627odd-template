import { describe, expect, it } from 'vitest';
import { AppError } from '../../common/app-error.js';
import { isSupportedImageBuffer } from '../../services/storage.service.js';
import {
  assertFarmerStatusTransition,
  assertListingCanActivate,
} from './listing-status.js';
import {
  createListingBodySchema,
  listListingsQuerySchema,
  updateListingBodySchema,
} from './listings.schema.js';

const validListing = {
  crop: 'Wheat',
  category: 'grains',
  quantity: '500',
  unit: 'kg',
  pricePerUnit: '25.00',
  harvestDate: '2026-04-10',
  state: 'Punjab',
  district: 'Ludhiana',
  minimumOrderQuantity: '50',
  perishable: false,
};

describe('listing validation', () => {
  it('defaults a new listing to draft and coerces numeric decimals', () => {
    const parsed = createListingBodySchema.parse({
      ...validListing,
      quantity: 500,
    });
    expect(parsed.status).toBe('draft');
    expect(parsed.quantity).toBe('500');
  });

  it('rejects a minimum order larger than available quantity', () => {
    const result = createListingBodySchema.safeParse({
      ...validListing,
      minimumOrderQuantity: '501',
    });
    expect(result.success).toBe(false);
  });

  it('enforces money precision and non-empty patches', () => {
    expect(
      createListingBodySchema.safeParse({
        ...validListing,
        pricePerUnit: '25.001',
      }).success,
    ).toBe(false);
    expect(updateListingBodySchema.safeParse({}).success).toBe(false);
  });

  it('parses pagination and boolean filters', () => {
    const parsed = listListingsQuerySchema.parse({
      page: '2',
      limit: '10',
      mine: 'true',
      perishable: 'false',
    });
    expect(parsed).toMatchObject({
      page: 2,
      limit: 10,
      mine: true,
      perishable: false,
    });
  });
});

describe('listing status rules', () => {
  it('allows activation from draft and deactivation from active', () => {
    expect(() => assertFarmerStatusTransition('draft', 'active')).not.toThrow();
    expect(() => assertFarmerStatusTransition('active', 'draft')).not.toThrow();
  });

  it('rejects invalid farmer transitions', () => {
    expect(() => assertFarmerStatusTransition('draft', 'removed')).toThrow(AppError);
  });

  it('requires a photo and valid quantities for activation', () => {
    expect(() =>
      assertListingCanActivate({
        photoCount: 0,
        quantity: '10',
        minimumOrderQuantity: '1',
      }),
    ).toThrow('Active listings require at least one photo');
    expect(() =>
      assertListingCanActivate({
        photoCount: 1,
        quantity: '10',
        minimumOrderQuantity: '1',
      }),
    ).not.toThrow();
  });
});

describe('listing photo validation', () => {
  it('checks image signatures instead of trusting MIME alone', () => {
    expect(
      isSupportedImageBuffer('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    ).toBe(true);
    expect(isSupportedImageBuffer('image/jpeg', Buffer.from('not an image'))).toBe(
      false,
    );
  });
});
