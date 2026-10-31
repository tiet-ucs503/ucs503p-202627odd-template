import { apiRequest } from './client';

export interface Message {
  id: string;
  orderId: string;
  senderId: string;
  sender: { id: string; name: string };
  body: string;
  sentAt: string;
  readAt: string | null;
}

export function listOrderMessages(orderId: string, query?: { page?: number; limit?: number }) {
  return apiRequest<Message[]>(`/api/v1/orders/${orderId}/messages`, { query });
}

export function sendOrderMessage(orderId: string, body: string) {
  return apiRequest<Message>(`/api/v1/orders/${orderId}/messages`, {
    method: 'POST',
    body: { body },
  });
}

export function markOrderMessagesRead(orderId: string) {
  return apiRequest<{ orderId: string; markedRead: number }>(
    `/api/v1/orders/${orderId}/messages/read`,
    { method: 'POST', body: {} },
  );
}
