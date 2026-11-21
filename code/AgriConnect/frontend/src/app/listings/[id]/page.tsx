'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { useLocale } from '@/features/i18n/locale-context';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner, Textarea, cx } from '@/components/ui';
import { ListingPhoto } from '@/components/listing-photo';
import { StarDisplay } from '@/components/star-rating';
import { BidForm } from '@/features/bids/BidForm';
import { FarmerBidsList } from '@/features/bids/FarmerBidsList';
import { BuyerBidsList } from '@/features/bids/BuyerBidsList';
import { createOrder } from '@/lib/api/orders';
import { getListing } from '@/lib/api/listings';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import type { Listing } from '@/lib/api/types';

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'bid'>('buy');

  useEffect(() => {
    void getListing(params.id)
      .then((result) => setListing(result.data))
      .catch((cause) => setError(getErrorMessage(cause, t('listing.notFound'))));
  }, [params.id, t]);

  if (error) return <Alert>{error}</Alert>;
  if (!listing) return <Spinner />;

  const photo = listing.photos[0]?.publicUrl;
  const canOrder = user?.role === 'BUYER' && listing.status === 'active' && !user.isSuspended;
  const isOwner = Boolean(
    user &&
      ((listing.farmer?.userId && user.id === listing.farmer.userId) ||
        (listing.farmerProfileId && user.farmerProfile?.id && user.farmerProfile.id === listing.farmerProfileId) ||
        ((listing as { farmerId?: string }).farmerId && user.id === (listing as { farmerId?: string }).farmerId)),
  );
  const unit = t(`units.${listing.unit}`);

  const currentListing = listing;

  async function placeOrder(form: FormData) {
    setError('');
    setPending(true);
    try {
      const { data } = await createOrder({
        listingId: currentListing.id,
        quantity: String(form.get('quantity') ?? ''),
        deliveryMode: String(form.get('deliveryMode')) === 'delivery' ? 'delivery' : 'pickup',
        notes: String(form.get('notes') || '') || undefined,
      });
      router.push(`/orders/${data.id}`);
    } catch (cause) {
      setError(getErrorMessage(cause, t('listing.place.fail')));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7 xl:col-span-8">
        <Card className="overflow-hidden p-0 shadow-sm border-forest/10">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-forest/8 sm:aspect-[2/1]">
            <ListingPhoto
              crop={listing.crop}
              src={photo}
              className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
            />
            <div className="photo-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="absolute start-3 top-3 flex flex-wrap gap-2">
              <Badge tone="good" onImage>
                {t(`listing.status.${listing.status}`)}
              </Badge>
              {listing.perishable ? (
                <Badge tone="gold" onImage>
                  {t('listing.perishable')}
                </Badge>
              ) : null}
              {listing.farmer?.verified ? (
                <Badge tone="good" onImage>
                  {t('listing.verifiedFarmer')}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="border-b border-forest/10 pb-5">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
                {listing.crop}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-base text-ink/75">
                <svg
                  className="h-4 w-4 shrink-0 text-leaf"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
                <span>
                  {listing.variety ? `${listing.variety} · ` : ''}
                  {listing.district}, {listing.state}
                </span>
              </p>
            </div>

            {/* Price Banner */}
            <div className="rounded-2xl border border-leaf/20 bg-leaf/5 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-soil">
                {t('marketplace.sortPriceAsc')}
              </p>
              <p className="font-display mt-1 text-3xl font-extrabold text-forest sm:text-4xl">
                {formatMoney(listing.pricePerUnit, locale)}{' '}
                <span className="text-base font-semibold text-ink/60">/ {unit}</span>
              </p>
            </div>

            {/* Harvest & Availability Specs */}
            <div className="space-y-3 rounded-2xl border border-forest/10 bg-sand/15 p-5 text-sm text-ink/80">
              <p className="font-medium">
                {t('listing.availableLine', {
                  qty: formatQty(listing.quantity, unit, locale),
                  min: formatQty(listing.minimumOrderQuantity, unit, locale),
                })}
              </p>
              <p className="text-ink/75">
                {t('listing.harvestLine', { date: formatDate(listing.harvestDate, locale) })}
              </p>
            </div>

            {listing.description ? (
              <div className="space-y-2 border-t border-forest/10 pt-5">
                <p className="text-sm leading-relaxed text-ink/80">{listing.description}</p>
              </div>
            ) : null}

            {listing.farmer ? (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-forest/10 bg-paper p-4 text-sm text-ink/70">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-paper"
                    aria-hidden="true"
                  >
                    {listing.farmer.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-forest">
                      {t('listing.soldBy', {
                        name: listing.farmer.farmName || listing.farmer.name,
                      })}
                    </p>
                    <div className="mt-0.5">
                      <StarDisplay value={listing.farmer.ratingAvg} />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Sticky Order Panel */}
      <div className="lg:col-span-5 xl:col-span-4">
        <div className="lg:sticky lg:top-24">
          <Card className="rounded-3xl border border-forest/10 bg-paper p-6 shadow-md shadow-forest/5 sm:p-7">
            {isOwner ? (
              <FarmerBidsList listingId={listing.id} />
            ) : !user ? (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-extrabold text-forest">
                  {t('listing.place.title')}
                </h2>
                <p className="text-sm text-ink/75 leading-relaxed">
                  {t('bid.loginPrompt')}
                </p>
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full font-bold shadow-sm"
                >
                  {t('nav.logIn')}
                </Button>
              </div>
            ) : user.role !== 'BUYER' ? (
              <p className="rounded-xl border border-harvest/30 bg-harvest/10 p-3.5 text-sm text-ink/80">
                {t('listing.place.buyerOnly')}
              </p>
            ) : listing.status !== 'active' ? (
              <p className="rounded-xl border border-forest/15 bg-sand/20 p-3.5 text-sm text-ink/75">
                {t('listing.place.notOpen')}
              </p>
            ) : (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-extrabold text-forest">
                  {t('listing.place.title')}
                </h2>

                {/* Segmented Tab Selector */}
                <div className="grid grid-cols-2 p-1 bg-sand/30 rounded-xl border border-forest/10 text-xs font-bold text-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab('buy')}
                    className={cx(
                      'py-2.5 rounded-lg transition-all cursor-pointer',
                      activeTab === 'buy'
                        ? 'bg-forest text-paper shadow-sm'
                        : 'text-forest/70 hover:text-forest',
                    )}
                  >
                    {t('bid.tabBuyNow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bid')}
                    className={cx(
                      'py-2.5 rounded-lg transition-all cursor-pointer',
                      activeTab === 'bid'
                        ? 'bg-forest text-paper shadow-sm'
                        : 'text-forest/70 hover:text-forest',
                    )}
                  >
                    {t('bid.tabMakeOffer')}
                  </button>
                </div>

                {activeTab === 'buy' ? (
                  <form className="space-y-4" action={placeOrder}>
                    {error ? <Alert>{error}</Alert> : null}
                    <Field label={t('listing.place.quantity', { unit })}>
                      <Input
                        name="quantity"
                        required
                        defaultValue={listing.minimumOrderQuantity}
                      />
                    </Field>
                    <Field label={t('listing.place.delivery')}>
                      <Select name="deliveryMode" defaultValue="pickup">
                        <option value="pickup">{t('listing.place.pickupOption')}</option>
                        <option value="delivery">{t('listing.place.deliveryOption')}</option>
                      </Select>
                    </Field>
                    <Field label={t('listing.place.notes')}>
                      <Textarea name="notes" rows={2} />
                    </Field>
                    <Button
                      type="submit"
                      disabled={pending || !canOrder}
                      className="w-full text-base font-bold py-3.5 shadow-md shadow-leaf/20 hover:shadow-lg transition-all"
                    >
                      {pending ? t('listing.place.submitting') : t('listing.place.submit')}
                    </Button>
                  </form>
                ) : (
                  <BidForm
                    listing={{
                      id: listing.id,
                      crop: listing.crop,
                      unit: listing.unit,
                      pricePerUnit: listing.pricePerUnit,
                      quantity: listing.quantity,
                      minimumOrderQuantity: listing.minimumOrderQuantity,
                    }}
                  />
                )}

                {/* Buyer's active bids on this listing */}
                <div className="border-t border-forest/10 pt-4">
                  <BuyerBidsList listingId={listing.id} />
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
