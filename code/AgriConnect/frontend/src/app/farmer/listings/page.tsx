'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { ListingCard } from '@/components/listing-card';
import { Button, EmptyState, Spinner, Alert } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { listListings } from '@/lib/api/listings';
import { getErrorMessage } from '@/lib/api/errors';
import type { Listing } from '@/lib/api/types';

function FarmerListings() {
  const { t } = useLocale();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void listListings({ mine: true, limit: 50 })
      .then((result) => setListings(result.data))
      .catch((cause) => setError(getErrorMessage(cause)));
  }, []);

  if (error && !listings) return <Alert>{error}</Alert>;
  if (!listings) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl text-forest">{t('listing.minTitle')}</h1>
        <Link href="/farmer/listings/new">
          <Button>{t('dashboard.addProduce')}</Button>
        </Link>
      </div>
      {listings.length === 0 ? (
        <EmptyState title={t('listing.minEmptyTitle')} body={t('listing.minEmptyBody')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <div key={listing.id} className="space-y-2">
              <ListingCard listing={listing} />
              <Link href={`/farmer/listings/${listing.id}/edit`} className="block text-center font-semibold text-leaf">
                {t('common.edit')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FarmerListingsPage() {
  return (
    <RequireAuth roles={['FARMER']}>
      <FarmerListings />
    </RequireAuth>
  );
}
