'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ListingCard } from '@/components/listing-card';
import { Button, Spinner } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { listListings } from '@/lib/api/listings';
import { isPublicListing } from '@/lib/listing-display';
import type { Listing } from '@/lib/api/types';

export function PublicListingsPreview() {
  const { t } = useLocale();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listListings({ sort: 'createdAt_desc', limit: 12 })
      .then((result) => {
        if (!cancelled) {
          setListings(result.data.filter((listing) => isPublicListing(listing.crop)).slice(0, 3));
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner />;

  if (failed || listings.length === 0) {
    return (
      <div className="rounded-2xl border border-forest/10 bg-paper p-6">
        <p className="text-ink/70">{t('home.previewFallback')}</p>
        <Link href="/marketplace" className="mt-4 inline-block">
          <Button>{t('home.browseMarketplace')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
      <div className="mt-5">
        <Link href="/marketplace">
          <Button variant="secondary">{t('home.seeAll')}</Button>
        </Link>
      </div>
    </div>
  );
}
