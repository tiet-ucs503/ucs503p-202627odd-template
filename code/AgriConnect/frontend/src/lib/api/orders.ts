import { apiRequest } from './client';
import type {
  DeliveryMode,
  Order,
  OrderPayment,
  OrderStatus,
  PaymentMethod,
  PaymentMethodOption,
} from './types';

export function createOrder(body: {
  listingId: string;
  quantity: string;
  deliveryMode: DeliveryMode;
  notes?: string;
}) {
  return apiRequest<Order>('/api/v1/orders', { method: 'POST', body });
}

export function listOrders(query: { status?: OrderStatus; page?: number; limit?: number } = {}) {
  return apiRequest<Order[]>('/api/v1/orders', { query });
}

export function getOrder(id: string) {
  return apiRequest<Order>(`/api/v1/orders/${id}`);
}

export function updateOrderStatus(
  id: string,
  body: { status: OrderStatus; cancellationReason?: string | null },
) {
  return apiRequest<Order>(`/api/v1/orders/${id}/status`, {
    method: 'PATCH',
    body,
  });
}

export function updateOrderLogistics(
  id: string,
  body: { logisticsStatus: 'dispatched' | 'in_transit' | 'delivered' },
) {
  return apiRequest<Order>(`/api/v1/orders/${id}/logistics`, {
    method: 'PATCH',
    body,
  });
}

export interface InitPaymentResult extends OrderPayment {
  orderId: string;
  currency: string;
  /** `cod` skips the gateway, `mock` runs when Razorpay keys are absent. */
  mode: 'cod' | 'mock' | 'razorpay';
  message?: string;
  razorpayOrderId?: string;
  keyId?: string;
}

export function listPaymentMethods() {
  return apiRequest<PaymentMethodOption[]>('/api/v1/payments/methods');
}

export function initOrderPayment(id: string, body: { method: PaymentMethod }) {
  return apiRequest<InitPaymentResult>(`/api/v1/orders/${id}/payment`, {
    method: 'POST',
    body,
  });
}

export function confirmOrderPaymentHeld(id: string, body: { providerRef?: string } = {}) {
  return apiRequest<OrderPayment & { orderId: string; currency: string }>(
    `/api/v1/orders/${id}/payment/confirm`,
    { method: 'POST', body },
  );
}
