import { apiRequest } from './client';
import type {
  ActivityLog,
  AdminAnalytics,
  AdminUser,
  Listing,
  ListingStatus,
  Role,
} from './types';

export function listAdminUsers(query: {
  role?: Role;
  q?: string;
  suspended?: boolean;
  page?: number;
  limit?: number;
} = {}) {
  return apiRequest<AdminUser[]>('/api/v1/admin/users', { query });
}

export function suspendUser(id: string, body: { isSuspended: boolean; reason?: string }) {
  return apiRequest<AdminUser>(`/api/v1/admin/users/${id}/suspend`, {
    method: 'PATCH',
    body,
  });
}

export function verifyUser(id: string, verified: boolean) {
  return apiRequest<AdminUser>(`/api/v1/admin/users/${id}/verify`, {
    method: 'PATCH',
    body: { verified },
  });
}

export function moderateListing(
  id: string,
  body: { status: Extract<ListingStatus, 'removed' | 'active'>; reason?: string },
) {
  return apiRequest<Listing>(`/api/v1/admin/listings/${id}/moderate`, {
    method: 'PATCH',
    body,
  });
}

export function getAdminAnalytics() {
  return apiRequest<AdminAnalytics>('/api/v1/admin/analytics');
}

export function listActivityLogs(query: { page?: number; limit?: number } = {}) {
  return apiRequest<ActivityLog[]>('/api/v1/admin/activity-logs', { query });
}
