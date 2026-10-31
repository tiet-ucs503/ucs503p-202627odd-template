'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { Button, Card, Spinner, Alert } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { getMyReport } from '@/lib/api/reports';
import { listOrders } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format';
import { BuyerBidsList } from '@/features/bids/BuyerBidsList';
import type { BuyerReport } from '@/lib/api/types';

function BuyerHome() {
  const { locale, t } = useLocale();
  const [report, setReport] = useState<BuyerReport | null>(null);
  const [openOrders, setOpenOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const reportResult = await getMyReport();
        if (reportResult.data.role === 'BUYER') {
          setReport(reportResult.data);
        } else {
          setError(t('dashboard.buyerLoadFail'));
        }
        const ordersResult = await listOrders({ status: 'pending', limit: 1 });
        setOpenOrders(ordersResult.pagination?.total ?? ordersResult.data.length);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <Spinner />;
  if (error || !report) return <Alert>{error || t('dashboard.buyerLoadFail')}</Alert>;

  const totalOrders =
    report.totalOrders ??
    (report as unknown as { ordersCount?: number }).ordersCount ??
    0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-leaf/15 bg-gradient-to-br from-cream via-sand/20 to-leaf/5 p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-bold tracking-tight text-forest sm:text-4xl">
              {t('dashboard.buyerTitle')}
            </h1>
            <p className="text-sm text-ink/75 sm:text-base">{t('dashboard.buyerSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/marketplace">
              <Button className="gap-2 shadow-sm">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                {t('dashboard.browseProduce')}
              </Button>
            </Link>
            <Link href="/buyer/alerts">
              <Button variant="secondary">{t('dashboard.produceAlerts')}</Button>
            </Link>
            <Link href="/market-prices">
              <Button variant="secondary">{t('dashboard.marketPrices')}</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col justify-between border-forest/10 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-soil">
                {t('dashboard.orders')}
              </p>
              <p className="font-display mt-2 text-3xl font-extrabold text-forest sm:text-4xl">
                {totalOrders}
              </p>
            </div>
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest"
              aria-hidden="true"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.8"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.263-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 border-t border-forest/5 pt-3 text-xs font-medium text-ink/70">
            <span className="h-2 w-2 rounded-full bg-forest" aria-hidden="true" />
            <span>{t('dashboard.pendingOrders', { count: openOrders })}</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-harvest/20 bg-gradient-to-b from-cream/40 to-card p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-soil">
                {t('dashboard.spend')}
              </p>
              <p className="font-display mt-2 text-3xl font-extrabold text-forest sm:text-4xl">
                {formatMoney(report.totalSpend, locale)}
              </p>
            </div>
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-harvest/15 text-harvest"
              aria-hidden="true"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.8"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 border-t border-forest/5 pt-3 text-xs font-medium text-ink/70">
            <span className="h-2 w-2 rounded-full bg-harvest" aria-hidden="true" />
            <span>{formatMoney(report.totalSpend, locale)}</span>
          </div>
        </Card>
      </div>

      {/* Bids & Offers Workspace */}
      <div className="space-y-4 pt-4 border-t border-forest/10">
        <div>
          <h2 className="font-display text-2xl font-bold text-forest">
            {t('bid.buyerSectionTitle')}
          </h2>
          <p className="text-sm text-ink/75 mt-0.5">
            {t('bid.buyerSectionSubtitle')}
          </p>
        </div>
        <BuyerBidsList />
      </div>
    </div>
  );
}

export default function BuyerPage() {
  return (
    <RequireAuth roles={['BUYER']}>
      <BuyerHome />
    </RequireAuth>
  );
}
