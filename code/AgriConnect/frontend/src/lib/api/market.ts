import { apiRequest } from './client';

export interface PriceTrendPoint {
  id: string;
  crop: string;
  state: string;
  district: string | null;
  source: string;
  pricePerUnit: string;
  unit: string;
  recordedAt: string;
}

export interface MandiPriceRow {
  id: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string | null;
  grade: string | null;
  arrivalDate: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: 'quintal';
  pricePerKg: string;
  source: 'agmarknet';
  fetchedAt: string | null;
}

export interface MandiHistoryPoint {
  arrivalDate: string;
  avgModalPrice: number;
  avgMinPrice: number;
  avgMaxPrice: number;
  avgModalPricePerKg: string;
  dataPoints: number;
}

export function listPriceTrends(query: {
  crop?: string;
  state?: string;
  days?: number;
  limit?: number;
} = {}) {
  return apiRequest<PriceTrendPoint[]>('/api/v1/market/prices', { query });
}

export function getPriceTrendSummary(query: {
  crop?: string;
  state?: string;
  days?: number;
} = {}) {
  return apiRequest<
    Array<{
      crop: string;
      state: string;
      unit: string;
      pricePerUnit: string;
      source: string;
      recordedAt: string;
    }>
  >('/api/v1/market/prices/summary', { query });
}

export function getMandiStates() {
  return apiRequest<string[]>('/api/v1/market/mandi/states');
}

export function getMandiCommodities(query: { state: string }) {
  return apiRequest<string[]>('/api/v1/market/mandi/commodities', { query });
}

export function getLiveMandiPrices(query: {
  state: string;
  commodity: string;
  market?: string;
  latestOnly?: boolean;
}) {
  return apiRequest<MandiPriceRow[]>('/api/v1/market/mandi/prices', { query });
}

export function getMandiPriceHistory(query: {
  state?: string;
  commodity: string;
  market?: string;
  from?: string;
  to?: string;
}) {
  return apiRequest<MandiHistoryPoint[]>('/api/v1/market/mandi/history', { query });
}

export type MandiCompareVerdict = 'below_mandi' | 'above_mandi' | 'at_mandi' | 'unknown';

export interface MandiCompareResult {
  id: string;
  listingPricePerKg: string;
  mandiPricePerKg: string | null;
  diffPerKg: string | null;
  diffPercent: number | null;
  verdict: MandiCompareVerdict;
}

export function compareListingPrices(
  items: Array<{
    id: string;
    crop: string;
    state: string;
    pricePerUnit: string;
    unit: 'kg' | 'quintal' | 'ton';
  }>,
) {
  return apiRequest<MandiCompareResult[]>('/api/v1/market/prices/compare', {
    method: 'POST',
    body: { items },
  });
}
