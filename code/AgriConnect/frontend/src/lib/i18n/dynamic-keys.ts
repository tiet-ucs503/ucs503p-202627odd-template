import { CROP_CATEGORIES, MANDI_CROPS, UNITS } from '@/lib/constants';
import type { MessageKey } from './translate';

/**
 * The API types these as plain `string`, so narrow against the known set before
 * building a message key. Anything unrecognised (a new govt commodity, say) returns
 * null and the caller falls back to the raw value.
 */
function knownKey(values: readonly string[], namespace: string, value: string): MessageKey | null {
  return values.includes(value) ? (`${namespace}.${value}` as MessageKey) : null;
}

export function categoryKey(category: string): MessageKey | null {
  return knownKey(CROP_CATEGORIES, 'listing.category', category);
}

export function mandiCropKey(crop: string): MessageKey | null {
  return knownKey(MANDI_CROPS, 'mandiCrops', crop);
}

export function unitKey(unit: string): MessageKey | null {
  return knownKey(UNITS, 'units', unit);
}
