import type { Listing, Order } from '@/lib/api/types';

export const listing = {
  id: 'listing-1',
  farmerId: 'farmer-1',
  farmer: { id: 'farmer-1', name: 'Gurpreet Singh', verified: true, ratingAvg: '4.5' },
  crop: 'Wheat',
  category: 'grains',
  variety: null,
  quantity: '100',
  unit: 'quintal',
  pricePerUnit: '2200',
  minimumOrderQuantity: '10',
  harvestDate: '2026-03-01T00:00:00.000Z',
  perishable: false,
  status: 'active',
  state: 'Punjab',
  district: 'Ludhiana',
  village: null,
  description: null,
  photos: [],
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
} as unknown as Listing;

export const order = {
  id: 'order-1',
  listingId: 'listing-1',
  listing: { id: 'listing-1', crop: 'Wheat', photos: [] },
  buyerId: 'buyer-1',
  buyer: { id: 'buyer-1', name: 'Ravi Kumar', ratingAvg: null },
  farmerId: 'farmer-1',
  farmer: { id: 'farmer-1', name: 'Gurpreet Singh', ratingAvg: '4.5' },
  quantity: '20',
  unit: 'quintal',
  pricePerUnit: '2200',
  priceTotal: '44000',
  status: 'pending',
  deliveryMode: 'pickup',
  notes: null,
  cancellationReason: null,
  logisticsStatus: 'none',
  dispatchedAt: null,
  inTransitAt: null,
  logisticsDeliveredAt: null,
  payment: null,
  createdAt: '2026-02-02T00:00:00.000Z',
  updatedAt: '2026-02-02T00:00:00.000Z',
} as unknown as Order;

export function ok<T>(data: T) {
  return Promise.resolve({ data });
}

export function okList<T>(data: T[]) {
  return Promise.resolve({ data, pagination: { page: 1, limit: 20, total: data.length } });
}
