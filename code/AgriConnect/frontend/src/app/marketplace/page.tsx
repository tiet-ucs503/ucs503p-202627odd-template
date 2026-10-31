'use client';

import { useEffect, useState } from 'react';
import { ListingCard } from '@/components/listing-card';
import { Alert, Button, Card, EmptyState, Field, Input, Select, Spinner } from '@/components/ui';
import { listListings, type ListingFilters } from '@/lib/api/listings';
import { getErrorMessage } from '@/lib/api/errors';
import { isPublicListing } from '@/lib/listing-display';
import type { Listing } from '@/lib/api/types';
import { compareListingPrices, type MandiCompareResult } from '@/lib/api/market';
import { CROP_CATEGORIES, INDIAN_STATES } from '@/lib/constants';
import { useLocale } from '@/features/i18n/locale-context';

function mandiCompareMap(results: MandiCompareResult[]): Record<string, MandiCompareResult> {
  return Object.fromEntries(results.map((row) => [row.id, row]));
}

export default function MarketplacePage() {
  const { t } = useLocale();
  const [listings, setListings] = useState<Listing[]>([]);
  const [mandiCompare, setMandiCompare] = useState<Record<string, MandiCompareResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ListingFilters>({
    sort: 'createdAt_desc',
    page: 1,
    limit: 12,
  });

  useEffect(() => {
    let cancelled = false;
    void listListings(filters)
      .then((result) => {
        if (cancelled) return;
        const data = result.data;
        setListings(data);
        setError('');
        setLoading(false);
        if (data.length === 0) {
          setMandiCompare({});
          return;
        }
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
            if (!cancelled) setMandiCompare(mandiCompareMap(compareResult.data));
          })
          .catch(() => {
            if (!cancelled) setMandiCompare({});
          });
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(getErrorMessage(cause, t('marketplace.loadFail')));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filters, t]);

  function apply(form: FormData) {
    setLoading(true);
    setMandiCompare({});
    setFilters({
      crop: String(form.get('crop') || '') || undefined,
      category: String(form.get('category') || '') || undefined,
      state: String(form.get('state') || '') || undefined,
      minPrice: String(form.get('minPrice') || '') || undefined,
      maxPrice: String(form.get('maxPrice') || '') || undefined,
      sort: (String(form.get('sort') || 'createdAt_desc') as ListingFilters['sort']),
      page: 1,
      limit: 12,
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-forest">{t('marketplace.title')}</h1>
          <p className="mt-2 text-base text-ink/75">{t('marketplace.subtitle')}</p>
        </div>
        {!loading && listings.length > 0 ? (
          <span className="rounded-full bg-forest/8 px-4 py-1.5 text-xs font-bold text-forest">
            {listings.length}
          </span>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="sticky top-16 z-20">
        <Card className="p-4 sm:p-5 shadow-md border-forest/15 bg-paper/95 backdrop-blur-md">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" action={apply}>
            <Field label={t('marketplace.crop')}>
              <Input name="crop" placeholder={t('common.cropExample')} defaultValue={filters.crop} />
            </Field>
            <Field label={t('marketplace.category')}>
              <Select name="category" defaultValue={filters.category ?? ''}>
                <option value="">{t('common.select')}</option>
                {CROP_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`listing.category.${category}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('marketplace.state')}>
              <Select name="state" defaultValue={filters.state ?? ''}>
                <option value="">{t('common.select')}</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('marketplace.minPrice')}>
              <Input name="minPrice" defaultValue={filters.minPrice} />
            </Field>
            <Field label={t('marketplace.maxPrice')}>
              <Input name="maxPrice" defaultValue={filters.maxPrice} />
            </Field>
            <Field label={t('marketplace.sort')}>
              <Select name="sort" defaultValue={filters.sort}>
                <option value="createdAt_desc">{t('marketplace.sortNewest')}</option>
                <option value="price_asc">{t('marketplace.sortPriceAsc')}</option>
                <option value="price_desc">{t('marketplace.sortPriceDesc')}</option>
                <option value="harvestDate_asc">{t('marketplace.sortHarvest')}</option>
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6 flex justify-end pt-1">
              <Button type="submit" className="w-full sm:w-auto px-7 shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
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
                setLoading(true);
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
