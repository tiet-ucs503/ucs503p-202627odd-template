'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { Button, Card, EmptyState, Spinner, Alert } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { getMyReport } from '@/lib/api/reports';
import { listListings } from '@/lib/api/listings';
import { listOrders } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format';
import type { FarmerReport } from '@/lib/api/types';

function FarmerHome() {
  const { locale, t } = useLocale();
  const [report, setReport] = useState<FarmerReport | null>(null);
  const [openOrders, setOpenOrders] = useState(0);
  const [activeListings, setActiveListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const reportResult = await getMyReport();
        if (reportResult.data.role === 'FARMER') {
          setReport(reportResult.data);
        } else {
          setError(t('dashboard.farmerLoadFail'));
        }
        const ordersResult = await listOrders({ status: 'pending', limit: 1 });
        setOpenOrders(ordersResult.pagination?.total ?? ordersResult.data.length);
        const listingsResult = await listListings({ mine: true, status: 'active', limit: 1 });
        setActiveListings(
          listingsResult.pagination?.total ?? listingsResult.data.length,
        );
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <Spinner />;
  if (error || !report) return <Alert>{error || t('dashboard.farmerLoadFail')}</Alert>;

  const totalListings =
    report.totalListings ??
    (report as unknown as { listingsCount?: number }).listingsCount ??
    0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-leaf/15 bg-gradient-to-br from-cream via-sand/20 to-leaf/5 p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-bold tracking-tight text-forest sm:text-4xl">
              {t('dashboard.farmerTitle')}
            </h1>
            <p className="text-sm text-ink/75 sm:text-base">{t('dashboard.farmerSubtitle')}</p>
          </div>
          <Link href="/farmer/listings/new">
            <Button className="gap-2 shadow-sm">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('dashboard.addProduce')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card className="flex flex-col justify-between border-forest/10 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-soil">
                {t('dashboard.listings')}
              </p>
              <p className="font-display mt-2 text-3xl font-extrabold text-forest sm:text-4xl">
                {totalListings}
              </p>
            </div>
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-leaf/10 text-leaf"
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
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 border-t border-forest/5 pt-3 text-xs font-medium text-ink/70">
            <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
            <span>{t('dashboard.activeNow', { count: activeListings })}</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-harvest/20 bg-gradient-to-b from-cream/40 to-card p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-soil">
                {t('dashboard.revenue')}
              </p>
              <p className="font-display mt-2 text-3xl font-extrabold text-forest sm:text-4xl">
                {formatMoney(report.revenue, locale)}
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
        </Card>

        <Card className="flex flex-col justify-between border-forest/10 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-soil">
                {t('dashboard.qtySold')}
              </p>
              <p className="font-display mt-2 text-3xl font-extrabold text-forest sm:text-4xl">
                {report.totalQuantitySold}
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
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 border-t border-forest/5 pt-3 text-xs font-medium text-ink/70">
            <span className="h-2 w-2 rounded-full bg-forest" aria-hidden="true" />
            <span>{t('dashboard.pendingOrders', { count: openOrders })}</span>
          </div>
        </Card>
      </div>

      {totalListings === 0 ? (
        <EmptyState
          title={t('dashboard.noListingsTitle')}
          body={t('dashboard.noListingsBody')}
          action={
            <Link href="/farmer/listings/new">
              <Button>{t('dashboard.createFirst')}</Button>
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

export default function FarmerPage() {
  return (
    <RequireAuth roles={['FARMER']}>
      <FarmerHome />
    </RequireAuth>
  );
}
