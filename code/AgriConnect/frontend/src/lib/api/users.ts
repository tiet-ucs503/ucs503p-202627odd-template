import { apiRequest } from './client';
import type { AuthUser, BuyerProfile, BuyerType, FarmerProfile } from './types';

export function updateMe(body: Partial<Pick<AuthUser, 'name' | 'phone' | 'languagePref' | 'state' | 'district' | 'village'>>) {
  return apiRequest<AuthUser>('/api/v1/users/me', { method: 'PATCH', body });
}

export function getFarmerProfile() {
  return apiRequest<FarmerProfile>('/api/v1/users/me/farmer-profile');
}

export function updateFarmerProfile(body: { farmName?: string; region?: string }) {
  return apiRequest<FarmerProfile>('/api/v1/users/me/farmer-profile', {
    method: 'PATCH',
    body,
  });
}

export function getBuyerProfile() {
  return apiRequest<BuyerProfile>('/api/v1/users/me/buyer-profile');
}

export function updateBuyerProfile(body: { businessName?: string; buyerType?: BuyerType }) {
  return apiRequest<BuyerProfile>('/api/v1/users/me/buyer-profile', {
    method: 'PATCH',
    body,
  });
}

export function exportMyData() {
  return apiRequest<Record<string, unknown>>('/api/v1/users/me/export');
}

export function deleteMyAccount() {
  return apiRequest<{ deleted: boolean }>('/api/v1/users/me', {
    method: 'DELETE',
    body: { confirm: 'DELETE' },
  });
}

export function getPublicFarmer(id: string) {
  return apiRequest<{
    id: string;
    name: string;
    role: 'FARMER';
    state: string | null;
    district: string | null;
    verified: boolean;
    farmName: string | null;
    ratingAvg: string | number | null;
  }>(`/api/v1/users/${id}/public`, { skipAuth: true });
}
