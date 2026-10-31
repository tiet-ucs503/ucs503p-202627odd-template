import { apiRequest } from './client';
import type { Listing, ListingPhoto, ListingStatus } from './types';

export interface ListingFilters {
  crop?: string;
  category?: string;
  state?: string;
  district?: string;
  minPrice?: string;
  maxPrice?: string;
  minQuantity?: string;
  harvestFrom?: string;
  harvestTo?: string;
  perishable?: boolean;
  status?: ListingStatus;
  mine?: boolean;
  sort?: 'createdAt_desc' | 'price_asc' | 'price_desc' | 'harvestDate_asc';
  page?: number;
  limit?: number;
}

export interface ListingWriteInput {
  crop: string;
  category: string;
  variety?: string | null;
  quantity: string;
  unit: 'kg' | 'quintal' | 'ton';
  pricePerUnit: string;
  harvestDate: string;
  state: string;
  district: string;
  village?: string | null;
  description?: string | null;
  minimumOrderQuantity: string;
  status?: 'draft' | 'active';
  perishable: boolean;
}

export function listListings(query: ListingFilters = {}) {
  return apiRequest<Listing[]>('/api/v1/listings', { query });
}

export function getListing(id: string) {
  return apiRequest<Listing>(`/api/v1/listings/${id}`);
}

export function createListing(body: ListingWriteInput) {
  return apiRequest<Listing>('/api/v1/listings', { method: 'POST', body });
}

export function updateListing(id: string, body: Partial<ListingWriteInput>) {
  return apiRequest<Listing>(`/api/v1/listings/${id}`, { method: 'PATCH', body });
}

export function deleteListing(id: string) {
  return apiRequest<{ deleted: boolean }>(`/api/v1/listings/${id}`, {
    method: 'DELETE',
  });
}

export function uploadListingPhotos(id: string, files: File[]) {
  const body = new FormData();
  for (const file of files) {
    body.append('files', file);
  }
  return apiRequest<{ photos: ListingPhoto[] }>(`/api/v1/listings/${id}/photos`, {
    method: 'POST',
    body,
  });
}

export function deleteListingPhoto(listingId: string, photoId: string) {
  return apiRequest<{ deleted: boolean }>(
    `/api/v1/listings/${listingId}/photos/${photoId}`,
    { method: 'DELETE' },
  );
}
