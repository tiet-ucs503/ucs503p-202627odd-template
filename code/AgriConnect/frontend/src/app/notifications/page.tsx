'use client';

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { Button, Card, EmptyState, Spinner, Alert } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';
import { getErrorMessage } from '@/lib/api/errors';
import { notifyNotificationsUpdated } from '@/lib/notifications-events';
import { notificationCopy } from '@/features/notifications/notification-copy';
import { formatDate, titleCase } from '@/lib/format';
import type { MessageKey } from '@/lib/i18n';
import type { NotificationItem } from '@/lib/api/types';

/** Server-side enum values; unknown types fall back to their title-cased name. */
const TYPE_KEYS: Record<string, MessageKey> = {
  ORDER_PLACED: 'alerts.type.ORDER_PLACED',
  ORDER_STATUS_CHANGED: 'alerts.type.ORDER_STATUS_CHANGED',
  MESSAGE_RECEIVED: 'alerts.type.MESSAGE_RECEIVED',
  LISTING_EXPIRING: 'alerts.type.LISTING_EXPIRING',
  LISTING_PUBLISHED: 'alerts.type.LISTING_PUBLISHED',
  ACCOUNT_SUSPENDED: 'alerts.type.ACCOUNT_SUSPENDED',
  LISTING_MODERATED: 'alerts.type.LISTING_MODERATED',
  PASSWORD_RESET: 'alerts.type.PASSWORD_RESET',
};

function Notifications() {
  const { locale, t } = useLocale();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState('');

  function reload() {
    void listNotifications({ limit: 50 })
      .then((result) => {
        setItems(result.data);
        setError('');
      })
      .catch((cause) => setError(getErrorMessage(cause)));
  }

  useEffect(() => {
    reload();
  }, []);

  if (error && !items) return <Alert>{error}</Alert>;
  if (!items) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl text-forest">{t('alerts.title')}</h1>
        <Button
          variant="secondary"
          type="button"
          onClick={() =>
            void markAllNotificationsRead().then(() => {
              reload();
              notifyNotificationsUpdated();
            })
          }
        >
          {t('alerts.markAllRead')}
        </Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {items.length === 0 ? (
        <EmptyState title={t('alerts.emptyTitle')} body={t('alerts.emptyBody')} />
      ) : (
        items.map((item) => {
          const copy = notificationCopy(item, t);
          return (
          <Card key={item.id} className={item.readAt ? 'opacity-70' : ''}>
            <p className="text-xs font-bold uppercase text-soil">
              {TYPE_KEYS[item.type] ? t(TYPE_KEYS[item.type]) : titleCase(item.type)}
            </p>
            <h2 className="font-display text-2xl text-forest">{copy.title}</h2>
            <p className="mt-1">{copy.body}</p>
            <p className="mt-2 text-sm text-ink/60">{formatDate(item.createdAt, locale)}</p>
            {!item.readAt ? (
              <Button
                className="mt-3"
                variant="secondary"
                type="button"
                onClick={() =>
                  void markNotificationRead(item.id).then(() => {
                    reload();
                    notifyNotificationsUpdated();
                  })
                }
              >
                {t('alerts.markRead')}
              </Button>
            ) : null}
          </Card>
          );
        })
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}
