import { apiRequest } from './client';

export interface BuyerCropAlert {
  id: string;
  crop: string | null;
  state: string | null;
  enabled: boolean;
  createdAt: string;
}

export function listMyAlerts() {
  return apiRequest<BuyerCropAlert[]>('/api/v1/alerts');
}

export function createAlert(body: {
  crop?: string | null;
  state?: string | null;
  enabled?: boolean;
}) {
  return apiRequest<BuyerCropAlert>('/api/v1/alerts', { method: 'POST', body });
}

export function deleteAlert(id: string) {
  return apiRequest<{ deleted: boolean }>(`/api/v1/alerts/${id}`, { method: 'DELETE' });
}
