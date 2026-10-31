'use client';

import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { ListingPhoto } from '@/components/listing-photo';
import { useLocale } from '@/features/i18n/locale-context';
import { formatMoney, formatQty } from '@/lib/format';
import { categoryKey } from '@/lib/i18n';
import type { Listing } from '@/lib/api/types';
import type { MandiCompareResult } from '@/lib/api/market';
import { MandiCompareBadge } from '@/components/mandi-compare-badge';

const statusTone = {
  draft: 'neutral',
  active: 'good',
  sold_out: 'warn',
  expired: 'warn',
  removed: 'bad',
} as const;

export function ListingCard({
  listing,
  mandiCompare,
}: {
  listing: Listing;
  mandiCompare?: MandiCompareResult | null;
}) {
  const { locale, t } = useLocale();
  const unit = t(`units.${listing.unit}`);
  const category = categoryKey(listing.category);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
    >
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-leaf/40 group-hover:shadow-[0_14px_28px_rgba(31,61,43,0.12)]">
        <div className="relative aspect-[16/10] overflow-hidden bg-forest/8">
          <ListingPhoto
            crop={listing.crop}
            src={listing.photos[0]?.publicUrl}
            className="transition duration-300 group-hover:scale-[1.04]"
          />
          <div className="photo-scrim pointer-events-none absolute inset-0" aria-hidden />
          <div className="absolute start-2.5 top-2.5 flex flex-wrap gap-1.5">
            {listing.status !== 'active' ? (
              <Badge tone={statusTone[listing.status]} onImage>
                {t(`listing.status.${listing.status}`)}
              </Badge>
            ) : null}
            {listing.perishable ? (
              <Badge tone="gold" onImage>{t('listing.perishable')}</Badge>
            ) : null}
            {mandiCompare ? <MandiCompareBadge compare={mandiCompare} onImage /> : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-soil/80">
              {category ? t(category) : listing.category}
            </p>
            {listing.farmer?.verified ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-leaf">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-leaf" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                </svg>
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 font-display text-xl font-bold leading-tight text-forest group-hover:text-leaf transition-colors duration-200">
            {listing.crop}
          </h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/70">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden>
              <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433 1.244-.77 2.87-2.029 4.135-3.856C17.065 12.28 18 9.77 18 7a8 8 0 1 0-16 0c0 2.77.935 5.28 2.493 7.496 1.265 1.827 2.891 3.086 4.135 3.856.311.193.571.337.757.433a5.741 5.741 0 0 0 .281.14l.018.008.006.003ZM10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
            </svg>
            <span className="truncate">{listing.district}, {listing.state}</span>
          </p>
          <div className="mt-auto border-t border-forest/8 pt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-lg font-bold text-forest">
                {formatMoney(listing.pricePerUnit, locale)}{' '}
                <span className="text-xs font-semibold text-ink/50">/ {unit}</span>
              </p>
            </div>
            <p className="mt-1 text-xs font-medium text-ink/65">
              {t('listing.leftLine', {
                qty: formatQty(listing.quantity, unit, locale),
                min: formatQty(listing.minimumOrderQuantity, unit, locale),
              })}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
