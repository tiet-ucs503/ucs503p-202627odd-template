import { apiRequest } from './client';
import type {
  Bid,
  BidStatus,
  CounterBidInput,
  CreateBidInput,
  Order,
  RejectBidInput,
} from './types';

export function createBid(body: CreateBidInput) {
  return apiRequest<Bid>('/api/v1/bids', { method: 'POST', body });
}

export function listListingBids(listingId: string) {
  return apiRequest<Bid[]>(`/api/v1/bids/listing/${listingId}`);
}

export function listMyBids(query: { status?: BidStatus; page?: number; limit?: number } = {}) {
  return apiRequest<Bid[]>('/api/v1/bids/my-bids', { query });
}

export function listIncomingBids(
  query: { status?: BidStatus; page?: number; limit?: number } = {},
) {
  return apiRequest<Bid[]>('/api/v1/bids/incoming', { query });
}

export function acceptBid(id: string) {
  return apiRequest<{ bid: Bid; order: Order }>(`/api/v1/bids/${id}/accept`, {
    method: 'POST',
  });
}

export function rejectBid(id: string, body?: RejectBidInput) {
  return apiRequest<Bid>(`/api/v1/bids/${id}/reject`, {
    method: 'POST',
    body,
  });
}

export function counterBid(id: string, body: CounterBidInput) {
  return apiRequest<Bid>(`/api/v1/bids/${id}/counter`, {
    method: 'POST',
    body,
  });
}

export function withdrawBid(id: string) {
  return apiRequest<Bid>(`/api/v1/bids/${id}/withdraw`, {
    method: 'POST',
  });
}
