'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { Badge, Card, EmptyState, Spinner, Alert } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { listOrders } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import type { Order } from '@/lib/api/types';

const tones = {
  pending: 'warn',
  accepted: 'gold',
  confirmed: 'good',
  fulfilled: 'good',
  cancelled: 'bad',
} as const;

function OrdersList() {
  const { locale, t } = useLocale();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void listOrders({ limit: 50 })
      .then((result) => setOrders(result.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!orders) return <Spinner />;

  // Active trades first; cancelled smoke leftovers used to bury the real pipeline.
  const STATUS_RANK: Record<Order['status'], number> = {
    pending: 0,
    accepted: 1,
    confirmed: 2,
    fulfilled: 3,
    cancelled: 4,
  };
  const sorted = [...orders].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-forest/10 pb-5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
          {t('order.listTitle')}
        </h1>
      </div>

      {sorted.length === 0 ? (
        <EmptyState title={t('order.emptyTitle')} body={t('order.emptyBody')} />
      ) : (
        <div className="space-y-3.5">
          {sorted.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="block group">
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 transition-all duration-200 group-hover:border-leaf/40 group-hover:shadow-md">
                <div className="space-y-1">
                  <p className="font-display text-2xl font-bold text-forest group-hover:text-leaf transition-colors">
                    {order.listing?.crop ?? t('order.produceFallback')}
                  </p>
                  <p className="text-sm text-ink/75">
                    {formatQty(order.quantity, t(`units.${order.unit}`), locale)} ·{' '}
                    <span className="font-bold text-forest">{formatMoney(order.priceTotal, locale)}</span> ·{' '}
                    <span>{formatDate(order.createdAt, locale)}</span>
                  </p>
                  <p className="mt-1 text-sm font-bold text-leaf flex items-center gap-1 group-hover:underline">
                    <span>{t('order.openCta')}</span>
                  </p>
                </div>
                <Badge tone={tones[order.status]}>{t(`order.status.${order.status}`)}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersList />
    </RequireAuth>
  );
}
