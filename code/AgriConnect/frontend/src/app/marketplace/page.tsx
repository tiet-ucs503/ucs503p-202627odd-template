'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListingCard } from '@/components/listing-card';
import { Alert, Button, Card, EmptyState, Field, Input, Select, Spinner } from '@/components/ui';
import { listListings, type ListingFilters } from '@/lib/api/listings';
import { getErrorMessage } from '@/lib/api/errors';
import { isPublicListing } from '@/lib/listing-display';
import type { Listing } from '@/lib/api/types';
import { compareListingPrices, type MandiCompareResult } from '@/lib/api/market';
import { CROP_CATEGORIES, INDIAN_STATES } from '@/lib/constants';
import { useLocale } from '@/features/i18n/locale-context';
import { connectSocket } from '@/lib/socket';
import { matchCropCategory } from '@/lib/crop-categories';

function mandiCompareMap(results: MandiCompareResult[]): Record<string, MandiCompareResult> {
  return Object.fromEntries(results.map((row) => [row.id, row]));
}

export default function MarketplacePage() {
  const { t } = useLocale();
  const [listings, setListings] = useState<Listing[]>([]);
  const [mandiCompare, setMandiCompare] = useState<Record<string, MandiCompareResult>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ListingFilters>({
    sort: 'createdAt_desc',
    page: 1,
    limit: 12,
  });
  const [cropQuery, setCropQuery] = useState(filters.crop ?? '');
  const [selectedCategory, setSelectedCategory] = useState(filters.category ?? '');
  const [selectedState, setSelectedState] = useState(filters.state ?? '');
  const [minPrice, setMinPrice] = useState(filters.minPrice ?? '');
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice ?? '');
  const [sortBy, setSortBy] = useState<ListingFilters['sort']>(filters.sort ?? 'createdAt_desc');

  const handleCropChange = (value: string) => {
    setCropQuery(value);
    const guessed = matchCropCategory(value);
    if (guessed) {
      setSelectedCategory(guessed);
    }
  };

  const fetchListings = useCallback(
    async (currentFilters: ListingFilters, silent = false) => {
      if (!silent) setLoading(true);
      setRefreshing(true);
      try {
        const result = await listListings(currentFilters);
        const data = result.data;
        setListings(data);
        setError('');
        if (data.length === 0) {
          setMandiCompare({});
        } else {
          // Mandi badges are optional — do not block the listing grid on compare.
          void compareListingPrices(
            data.map((listing) => ({
              id: listing.id,
              crop: listing.crop,
              state: listing.state,
              pricePerUnit: listing.pricePerUnit,
              unit: listing.unit,
            })),
          )
            .then((compareResult) => {
              setMandiCompare(mandiCompareMap(compareResult.data));
            })
            .catch(() => {
              setMandiCompare({});
            });
        }
      } catch (cause) {
        if (!silent) {
          setError(getErrorMessage(cause, t('marketplace.loadFail')));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  // Initial and filter-change fetch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchListings(filters);
  }, [filters, fetchListings]);

  // Real-time WebSocket updates when farmers create or edit listings
  useEffect(() => {
    let client: ReturnType<typeof connectSocket> | null = null;
    let onListingChange: (() => void) | null = null;
    try {
      client = connectSocket();
      onListingChange = () => {
        void fetchListings(filters, true);
      };
      client.on('marketplace:listing:change', onListingChange);
    } catch {
      // Graceful fallback if socket is unavailable in the current environment
    }

    return () => {
      if (client && onListingChange) {
        client.off('marketplace:listing:change', onListingChange);
      }
    };
  }, [filters, fetchListings]);

  // Window Focus & Visibility Revalidation
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchListings(filters, true);
      }
    };
    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [filters, fetchListings]);

  // Periodic gentle polling fallback
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void fetchListings(filters, true);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [filters, fetchListings]);

  function apply(e?: React.FormEvent<HTMLFormElement> | FormData) {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    setMandiCompare({});
    const newCrop = cropQuery.trim() || undefined;
    const newCategory = selectedCategory.trim() || undefined;
    const newState = selectedState.trim() || undefined;
    const newMin = minPrice.trim() || undefined;
    const newMax = maxPrice.trim() || undefined;
    setFilters({
      crop: newCrop,
      category: newCategory,
      state: newState,
      minPrice: newMin,
      maxPrice: newMax,
      sort: sortBy,
      page: 1,
      limit: 12,
    });
  }

  function handleManualRefresh() {
    void fetchListings(filters, false);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-forest">{t('marketplace.title')}</h1>
          <p className="mt-2 text-base text-ink/75">{t('marketplace.subtitle')}</p>
        </div>
        {!loading && listings.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-forest/8 px-4 py-1.5 text-xs font-bold text-forest">
              {listings.length}
            </span>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-full p-2 text-forest/75 hover:bg-forest/10 hover:text-forest transition-colors disabled:opacity-50"
              aria-label={t('common.loading')}
              title={t('common.loading')}
            >
              <svg
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="sticky top-16 z-20">
        <Card className="p-4 sm:p-5 shadow-md border-forest/15 bg-paper/95 backdrop-blur-md">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" onSubmit={apply}>
            <Field label={t('marketplace.crop')}>
              <Input
                name="crop"
                placeholder={t('common.cropExample')}
                value={cropQuery}
                onChange={(e) => handleCropChange(e.target.value)}
              />
            </Field>
            <Field label={t('marketplace.category')}>
              <Select
                name="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">{t('common.select')}</option>
                {CROP_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`listing.category.${category}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('marketplace.state')}>
              <Select
                name="state"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
              >
                <option value="">{t('common.select')}</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('marketplace.minPrice')}>
              <Input
                name="minPrice"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </Field>
            <Field label={t('marketplace.maxPrice')}>
              <Input
                name="maxPrice"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </Field>
            <Field label={t('marketplace.sort')}>
              <Select
                name="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ListingFilters['sort'])}
              >
                <option value="createdAt_desc">{t('marketplace.sortNewest')}</option>
                <option value="price_asc">{t('marketplace.sortPriceAsc')}</option>
                <option value="price_desc">{t('marketplace.sortPriceDesc')}</option>
                <option value="harvestDate_asc">{t('marketplace.sortHarvest')}</option>
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6 flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="gap-2"
                aria-label={t('common.loading')}
              >
                <svg
                  className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </Button>
              <Button type="submit" className="w-full sm:w-auto px-7 shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
                </svg>
                <span>{t('marketplace.apply')}</span>
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {loading ? (
        <Spinner />
      ) : listings.length === 0 ? (
        <EmptyState
          title={t('marketplace.empty')}
          body={t('marketplace.subtitle')}
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMandiCompare({});
                setFilters({ sort: 'createdAt_desc', page: 1, limit: 12 });
              }}
            >
              {t('marketplace.apply')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.filter((listing) => isPublicListing(listing.crop)).map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              mandiCompare={mandiCompare[listing.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
