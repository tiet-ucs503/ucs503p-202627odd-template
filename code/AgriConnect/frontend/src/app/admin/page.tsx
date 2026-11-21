'use client';

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { Spinner, Alert, StatCard } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { getAdminAnalytics } from '@/lib/api/admin';
import { getErrorMessage } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format';
import type { AdminAnalytics } from '@/lib/api/types';

function AdminHome() {
  const { locale, t } = useLocale();
  const [stats, setStats] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void getAdminAnalytics()
      .then((result) => setStats(result.data))
      .catch((cause) => setError(getErrorMessage(cause)));
  }, []);

  if (error && !stats) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-forest/10 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-harvest">
            {t('nav.overview')}
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
            {t('admin.overviewTitle')}
          </h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('admin.users')}
          value={stats.totalUsers}
          tone="forest"
        />
        <StatCard
          label={t('admin.listings')}
          value={stats.totalListings}
          hint={t('admin.activeCount', { count: stats.activeListings ?? '—' })}
          tone="leaf"
        />
        <StatCard
          label={t('admin.orders')}
          value={stats.totalOrders}
          tone="forest"
        />
        <StatCard
          label={t('admin.gmv')}
          value={formatMoney(stats.gmv, locale)}
          tone="harvest"
        />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth roles={['ADMIN']}>
      <AdminHome />
    </RequireAuth>
  );
}
