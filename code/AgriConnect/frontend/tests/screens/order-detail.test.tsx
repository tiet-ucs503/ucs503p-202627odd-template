import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderPage from '@/app/orders/[id]/page';
import { BUYER } from '../utils/auth-state';
import { ok, okList, order } from '../utils/fixtures';
import { pa, renderWithLocale } from '../utils/render';

const current = vi.hoisted(() => ({ order: null as unknown }));

vi.mock('@/lib/api/orders', () => ({
  getOrder: vi.fn(() => ok(current.order)),
  updateOrderStatus: vi.fn(() => ok(order)),
  updateOrderLogistics: vi.fn(() => ok(order)),
  listPaymentMethods: vi.fn(() =>
    okList([
      { method: 'upi', label: 'UPI', escrow: true },
      { method: 'cod', label: 'Cash on delivery', escrow: false },
    ]),
  ),
  initOrderPayment: vi.fn(),
  confirmOrderPaymentHeld: vi.fn(),
}));

vi.mock('@/lib/api/messages', () => ({
  listOrderMessages: vi.fn(() => okList([])),
  sendOrderMessage: vi.fn(),
  markOrderMessagesRead: vi.fn(() => ok({ updated: 0 })),
}));

vi.mock('@/lib/api/reviews', () => ({
  listOrderReviews: vi.fn(() => okList([])),
  getMyOrderReview: vi.fn(() => ok(null)),
  createOrderReview: vi.fn(),
}));

vi.mock('@/lib/socket', () => ({
  joinOrderRoom: vi.fn(() => () => undefined),
  connectSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() })),
  getSocket: vi.fn(() => null),
  disconnectSocket: vi.fn(),
}));

vi.mock('@/lib/socket-typing', () => ({
  emitTyping: vi.fn(),
  subscribeToTyping: vi.fn(() => () => undefined),
}));

vi.mock('@/lib/call-signaling', () => ({
  subscribeToCalls: vi.fn(() => () => undefined),
  inviteToCall: vi.fn(),
  acceptCall: vi.fn(),
  declineCall: vi.fn(),
  endCall: vi.fn(),
  sendCallSignal: vi.fn(),
}));

describe('order detail in Punjabi', () => {
  beforeEach(() => {
    current.order = order;
  });

  it('translates the header, timeline, payment, call, and chat panels', async () => {
    renderWithLocale(<OrderPage />, { user: BUYER });

    expect(await screen.findByText(pa('order.status.pending'))).toBeInTheDocument();
    expect(screen.getByText(pa('order.timeline.placed'))).toBeInTheDocument();
    expect(screen.getByText(pa('order.timeline.escrowHeld'))).toBeInTheDocument();
    // Panel headings, since some of this copy also appears as a timeline step label.
    expect(screen.getByRole('heading', { name: pa('order.payment.title') })).toBeInTheDocument();
    expect(screen.getByText(pa('order.payment.chooseMethod'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: pa('order.call.title') })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: pa('order.chat.title') })).toBeInTheDocument();
  });

  it('translates the ratings panel once the order is fulfilled', async () => {
    current.order = { ...order, status: 'fulfilled' };
    renderWithLocale(<OrderPage />, { user: BUYER });

    expect(
      await screen.findByRole('heading', { name: pa('order.review.title') }),
    ).toBeInTheDocument();
    expect(screen.getByText(pa('order.review.comment'))).toBeInTheDocument();
    expect(screen.queryByText('Ratings')).not.toBeInTheDocument();
  });

  it('shows the delivery mode and placed date as translated sentences', async () => {
    renderWithLocale(<OrderPage />, { user: BUYER });
    await screen.findByText(pa('order.status.pending'));

    expect(
      screen.getByText(pa('order.deliveryLine', { mode: pa('order.deliveryMode.pickup') })),
    ).toBeInTheDocument();
    expect(screen.queryByText('Delivery: Pickup')).not.toBeInTheDocument();
    expect(screen.queryByText('Escrow held')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment')).not.toBeInTheDocument();
    expect(screen.queryByText('Order chat')).not.toBeInTheDocument();
  });
});
