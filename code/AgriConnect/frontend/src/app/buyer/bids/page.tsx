'use client';

import Link from 'next/link';
import { RequireAuth } from '@/features/auth/guards';
import { Button } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { BuyerBidsList } from '@/features/bids/BuyerBidsList';

function BuyerBidsContent() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-leaf/15 bg-gradient-to-br from-cream via-sand/20 to-leaf/5 p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-bold tracking-tight text-forest sm:text-4xl">
              {t('bid.buyerSectionTitle')}
            </h1>
            <p className="text-sm text-ink/75 sm:text-base">
              {t('bid.buyerSectionSubtitle')}
            </p>
          </div>
          <Link href="/marketplace">
            <Button className="gap-2 shadow-sm font-bold">
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
        </div>
      </div>

      <BuyerBidsList />
    </div>
  );
}

export default function BuyerBidsPage() {
  return (
    <RequireAuth roles={['BUYER']}>
      <BuyerBidsContent />
    </RequireAuth>
  );
}
