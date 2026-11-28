import { apiRequest } from './client';
import type { NotificationItem } from './types';

export function listNotifications(query: { unread?: boolean; page?: number; limit?: number } = {}) {
  return apiRequest<NotificationItem[]>('/api/v1/notifications', { query });
}

export function markNotificationRead(id: string) {
  return apiRequest<NotificationItem>(`/api/v1/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>('/api/v1/notifications/read-all', {
    method: 'POST',
  });
}
