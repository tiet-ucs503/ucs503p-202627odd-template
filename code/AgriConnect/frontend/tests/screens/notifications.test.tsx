import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotificationsPage from '@/app/notifications/page';
import { BUYER } from '../utils/auth-state';
import { ok, okList } from '../utils/fixtures';
import { pa, renderWithLocale } from '../utils/render';

const notification = {
  id: 'notif-1',
  type: 'ORDER_PLACED',
  title: 'New order',
  body: 'A buyer ordered 20 kg of Wheat.',
  params: { qty: '20', unit: 'kg', crop: 'Wheat' },
  readAt: null,
  createdAt: '2026-02-02T00:00:00.000Z',
};

/** Pre-migration row: no params, so the stored English copy is all we have. */
const legacyNotification = {
  id: 'notif-2',
  type: 'ORDER_STATUS_CHANGED',
  title: 'Order status updated',
  body: 'Order status changed from pending to accepted.',
  readAt: '2026-02-02T01:00:00.000Z',
  createdAt: '2026-02-01T00:00:00.000Z',
};

vi.mock('@/lib/api/notifications', () => ({
  listNotifications: vi.fn(() => okList([notification, legacyNotification])),
  markNotificationRead: vi.fn(() => ok(notification)),
  markAllNotificationsRead: vi.fn(() => ok({ updated: 1 })),
}));

vi.mock('@/lib/notifications-events', () => ({
  notifyNotificationsUpdated: vi.fn(),
  subscribeToNotificationUpdates: vi.fn(() => () => undefined),
}));

describe('notifications in Punjabi', () => {
  it('translates the title, the type label, and the actions', async () => {
    renderWithLocale(<NotificationsPage />, { user: BUYER });

    expect(await screen.findByText(pa('alerts.title'))).toBeInTheDocument();
    expect(screen.getByText(pa('alerts.type.ORDER_PLACED'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pa('alerts.markAllRead') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pa('alerts.markRead') })).toBeInTheDocument();
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
  });

  it('rebuilds server-written copy from params, and keeps English for rows without them', async () => {
    renderWithLocale(<NotificationsPage />, { user: BUYER });

    expect(await screen.findByText(pa('alerts.heading.ORDER_PLACED'))).toBeInTheDocument();
    expect(
      screen.getByText(pa('alerts.body.ORDER_PLACED', { qty: '20', unit: 'kg', crop: 'Wheat' })),
    ).toBeInTheDocument();
    expect(screen.queryByText('A buyer ordered 20 kg of Wheat.')).not.toBeInTheDocument();

    expect(
      screen.getByText('Order status changed from pending to accepted.'),
    ).toBeInTheDocument();
  });
});
