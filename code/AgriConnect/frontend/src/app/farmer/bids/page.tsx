'use client';

import Link from 'next/link';
import { RequireAuth } from '@/features/auth/guards';
import { Button } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { FarmerBidsList } from '@/features/bids/FarmerBidsList';

function FarmerBidsContent() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-leaf/15 bg-gradient-to-br from-cream via-sand/20 to-leaf/5 p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-bold tracking-tight text-forest sm:text-4xl">
              {t('bid.farmerIncomingTitle')}
            </h1>
            <p className="text-sm text-ink/75 sm:text-base">
              {t('bid.noBidsBody')}
            </p>
          </div>
          <Link href="/farmer/listings/new">
            <Button className="gap-2 shadow-sm font-bold">
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

      <FarmerBidsList />
    </div>
  );
}

export default function FarmerBidsPage() {
  return (
    <RequireAuth roles={['FARMER']}>
      <FarmerBidsContent />
    </RequireAuth>
  );
}
