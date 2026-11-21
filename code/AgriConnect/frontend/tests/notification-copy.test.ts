import { describe, expect, it } from 'vitest';
import { notificationCopy } from '@/features/notifications/notification-copy';
import { translate, type MessageKey } from '@/lib/i18n';
import type { NotificationItem } from '@/lib/api/types';

const t = (key: MessageKey, vars?: Record<string, string | number>) =>
  translate('pa', key, vars);

function item(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'n1',
    type: 'ORDER_PLACED',
    title: 'New order',
    body: 'A buyer ordered 20 kg of Wheat.',
    readAt: null,
    createdAt: '2026-02-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('notificationCopy', () => {
  it('falls back to the stored English copy when params are absent', () => {
    const copy = notificationCopy(item({}), t);
    expect(copy).toEqual({
      title: 'New order',
      body: 'A buyer ordered 20 kg of Wheat.',
    });
  });

  it('translates order status changes, including the status names', () => {
    const copy = notificationCopy(
      item({
        type: 'ORDER_STATUS_CHANGED',
        params: { variant: 'status', from: 'pending', to: 'accepted' },
      }),
      t,
    );
    expect(copy.title).toBe(t('alerts.heading.ORDER_STATUS_CHANGED'));
    expect(copy.body).toBe(
      t('alerts.body.ORDER_STATUS_CHANGED', {
        from: t('order.status.pending'),
        to: t('order.status.accepted'),
      }),
    );
  });

  it('reads the logistics variant as a delivery update', () => {
    const copy = notificationCopy(
      item({
        type: 'ORDER_STATUS_CHANGED',
        params: { variant: 'logistics', status: 'in_transit' },
      }),
      t,
    );
    expect(copy.title).toBe(t('alerts.heading.ORDER_LOGISTICS'));
    expect(copy.body).toBe(
      t('alerts.body.ORDER_LOGISTICS', { status: t('order.timeline.inTransit') }),
    );
  });

  it('reads the payment variant as a request to pay, keeping the amount', () => {
    const copy = notificationCopy(
      item({
        type: 'ORDER_STATUS_CHANGED',
        params: { variant: 'payment', amount: '12250.00' },
      }),
      t,
    );
    expect(copy.title).toBe(t('alerts.heading.ORDER_PAYMENT_DUE'));
    expect(copy.body).toBe(t('alerts.body.ORDER_PAYMENT_DUE', { amount: '12250.00' }));
    // The three ORDER_STATUS_CHANGED variants must not collapse into one sentence.
    expect(copy.title).not.toBe(t('alerts.heading.ORDER_STATUS_CHANGED'));
  });

  it('separates listing removal from reinstatement', () => {
    const removed = notificationCopy(
      item({ type: 'LISTING_MODERATED', params: { variant: 'removed' } }),
      t,
    );
    const reinstated = notificationCopy(
      item({ type: 'LISTING_MODERATED', params: { variant: 'reinstated' } }),
      t,
    );
    expect(removed.body).toBe(t('alerts.body.LISTING_REMOVED'));
    expect(reinstated.body).toBe(t('alerts.body.LISTING_REINSTATED'));
  });

  it("keeps an admin's reason and a chat preview verbatim", () => {
    const suspended = notificationCopy(
      item({ type: 'ACCOUNT_SUSPENDED', params: { reason: 'Duplicate listings' } }),
      t,
    );
    expect(suspended.body).toBe(t('alerts.body.reason', { reason: 'Duplicate listings' }));

    const message = notificationCopy(
      item({ type: 'MESSAGE_RECEIVED', params: { preview: 'Kal aa jao' } }),
      t,
    );
    expect(message.title).toBe(t('alerts.heading.MESSAGE_RECEIVED'));
    expect(message.body).toBe('Kal aa jao');
  });

  it('ignores an unknown notification type', () => {
    const copy = notificationCopy(
      item({ type: 'SOMETHING_NEW', title: 'Heads up', body: 'Server said so', params: {} }),
      t,
    );
    expect(copy).toEqual({ title: 'Heads up', body: 'Server said so' });
  });
});
