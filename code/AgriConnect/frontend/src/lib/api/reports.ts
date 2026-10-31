import { apiRequest } from './client';
import type { BuyerReport, FarmerReport } from './types';

export function getMyReport() {
  return apiRequest<FarmerReport | BuyerReport>('/api/v1/reports/me');
}
