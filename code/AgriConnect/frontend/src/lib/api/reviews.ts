import { apiRequest } from './client';

export interface Review {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  rating: number;
  comment: string | null;
  fromUser: { id: string; name: string };
  toUser: { id: string; name: string };
  createdAt: string;
}

export function listOrderReviews(orderId: string, query?: { page?: number; limit?: number }) {
  return apiRequest<Review[]>(`/api/v1/orders/${orderId}/reviews`, { query });
}

export function getMyOrderReview(orderId: string) {
  return apiRequest<Review | null>(`/api/v1/orders/${orderId}/reviews/me`);
}

export function createOrderReview(
  orderId: string,
  input: { rating: number; comment?: string },
) {
  return apiRequest<Review>(`/api/v1/orders/${orderId}/reviews`, {
    method: 'POST',
    body: input,
  });
}

export function listUserReviews(userId: string, query?: { page?: number; limit?: number }) {
  return apiRequest<Review[]>(`/api/v1/users/${userId}/reviews`, { query });
}
