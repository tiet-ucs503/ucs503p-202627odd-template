'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { acceptBid, listListingBids, listMyBids, withdrawBid } from '@/lib/api/bids';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import type { Bid } from '@/lib/api/types';

interface BuyerBidsListProps {
  listingId?: string;
  compact?: boolean;
  onBidChanged?: () => void;
}

type FilterTab = 'all' | 'action_needed' | 'pending' | 'accepted' | 'closed';

const statusTones = {
  pending: 'warn',
  accepted: 'good',
  rejected: 'bad',
  countered: 'gold',
  withdrawn: 'neutral',
} as const;

export function BuyerBidsList({ listingId, compact, onBidChanged }: BuyerBidsListProps = {}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [bids, setBids] = useState<Bid[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  const loadBids = useCallback(async () => {
    try {
      if (listingId) {
        const { data } = await listListingBids(listingId);
        setBids(data);
      } else {
        const { data } = await listMyBids({ limit: 50 });
        setBids(data);
      }
      setLoadError('');
    } catch (cause) {
      setLoadError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setLoading(false);
    }
  }, [listingId, t]);

  useEffect(() => {
    let mounted = true;
    async function initLoad() {
      try {
        if (listingId) {
          const { data } = await listListingBids(listingId);
          if (mounted) setBids(data);
        } else {
          const { data } = await listMyBids({ limit: 50 });
          if (mounted) setBids(data);
        }
      } catch (cause) {
        if (mounted) setLoadError(getErrorMessage(cause, t('common.errorGeneric')));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void initLoad();
    return () => {
      mounted = false;
    };
  }, [listingId, t]);

  async function handleWithdraw(bidId: string) {
    setActionPendingId(bidId);
    setActionError('');
    try {
      await withdrawBid(bidId);
      await loadBids();
      onBidChanged?.();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleAcceptCounter(bidId: string) {
    setActionPendingId(bidId);
    setActionError('');
    try {
      await acceptBid(bidId);
      await loadBids();
      onBidChanged?.();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPendingId(null);
    }
  }

  if (loading) return <Spinner />;
  if (loadError && !bids) {
    return (
      <div className="rounded-xl border border-harvest/30 bg-harvest/15 p-4 text-soil">
        <p className="text-sm font-semibold">{loadError}</p>
        <Button variant="secondary" onClick={() => void loadBids()} className="mt-2 text-xs">
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const allBids = bids ?? [];

  // Filter logic
  const filteredBids = allBids.filter((bid) => {
    if (filter === 'action_needed') return bid.status === 'countered';
    if (filter === 'pending') return bid.status === 'pending';
    if (filter === 'accepted') return bid.status === 'accepted';
    if (filter === 'closed') return bid.status === 'rejected' || bid.status === 'withdrawn';
    return true;
  });

  const actionNeededCount = allBids.filter((b) => b.status === 'countered').length;
  const pendingCount = allBids.filter((b) => b.status === 'pending').length;
  const acceptedCount = allBids.filter((b) => b.status === 'accepted').length;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl font-bold text-forest">
            {listingId ? t('bid.status.pending') : t('bid.buyerSectionTitle')}
          </h3>
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-bold text-forest">
            {allBids.length}
          </span>
        </div>

        {!listingId && compact ? (
          <Link
            href="/buyer/bids"
            className="text-xs font-bold text-leaf hover:underline flex items-center gap-1"
          >
            <span>{t('order.openCta')}</span> →
          </Link>
        ) : null}
      </div>

      {/* Filter Tabs (Full view only) */}
      {!listingId && !compact && allBids.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 p-1 bg-sand/25 rounded-xl border border-forest/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-forest text-paper shadow-sm font-bold'
                : 'text-forest/70 hover:text-forest'
            }`}
          >
            {t('bid.buyerSectionTitle')} ({allBids.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('action_needed')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filter === 'action_needed'
                ? 'bg-forest text-paper shadow-sm font-bold'
                : 'text-forest/70 hover:text-forest'
            }`}
          >
            <span>{t('bid.status.countered')}</span>
            {actionNeededCount > 0 ? (
              <span className="rounded-full bg-harvest px-1.5 py-0.2 text-[10px] text-ink font-extrabold">
                {actionNeededCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-forest text-paper shadow-sm font-bold'
                : 'text-forest/70 hover:text-forest'
            }`}
          >
            {t('bid.status.pending')} ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('accepted')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'accepted'
                ? 'bg-forest text-paper shadow-sm font-bold'
                : 'text-forest/70 hover:text-forest'
            }`}
          >
            {t('bid.status.accepted')} ({acceptedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('closed')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'closed'
                ? 'bg-forest text-paper shadow-sm font-bold'
                : 'text-forest/70 hover:text-forest'
            }`}
          >
            {t('bid.status.rejected')} / {t('bid.status.withdrawn')}
          </button>
        </div>
      ) : null}

      {/* Dismissable Action Error Notice */}
      {actionError ? (
        <div className="flex items-center justify-between rounded-xl border border-harvest/40 bg-harvest/15 p-3 text-xs text-soil">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError('')}
            className="rounded p-1 font-bold text-soil/70 hover:text-soil"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Empty States */}
      {allBids.length === 0 ? (
        listingId ? null : (
          <EmptyState
            title={t('bid.noBidsTitle')}
            body={t('bid.noBidsBody')}
            action={
              <Button onClick={() => router.push('/marketplace')} className="font-bold">
                {t('nav.browse')}
              </Button>
            }
          />
        )
      ) : filteredBids.length === 0 ? (
        <div className="rounded-xl border border-forest/10 bg-sand/15 p-8 text-center text-ink/70">
          <p className="text-sm font-semibold">{t('bid.noBidsTitle')}</p>
          <Button
            variant="ghost"
            onClick={() => setFilter('all')}
            className="mt-2 text-xs font-bold text-leaf"
          >
            {t('bid.buyerSectionTitle')} ({allBids.length})
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBids.map((bid) => {
            const isCountered = bid.status === 'countered';
            const isAccepted = bid.status === 'accepted';
            const isPending = bid.status === 'pending';
            const isActionBusy = actionPendingId === bid.id;

            return (
              <Card
                key={bid.id}
                className={`p-4 sm:p-5 transition-all ${
                  isCountered
                    ? 'border-harvest/50 bg-gradient-to-br from-cream via-harvest/5 to-cream shadow-sm ring-1 ring-harvest/30'
                    : 'border-forest/15'
                }`}
              >
                {/* Top Row: Crop Name & Status Badge */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-forest/8 pb-3">
                  <div>
                    {bid.listing ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/listings/${bid.listingId}`}
                          className="font-display text-lg font-bold text-forest hover:text-leaf hover:underline transition-colors"
                        >
                          {bid.listing.crop}
                        </Link>
                        {bid.listing.variety ? (
                          <span className="rounded-md bg-forest/5 px-2 py-0.5 text-xs font-medium text-soil">
                            {bid.listing.variety}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="font-display text-lg font-bold text-forest">
                        {t('order.produceFallback')}
                      </p>
                    )}
                    <p className="text-xs text-ink/60 mt-0.5">
                      {formatDate(bid.createdAt, locale)}
                    </p>
                  </div>
                  <Badge tone={statusTones[bid.status]}>
                    {t(`bid.status.${bid.status}`)}
                  </Badge>
                </div>

                {/* Offer Numbers Grid */}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-sand/20 p-3 my-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="text-soil font-medium">
                      {t('bid.offerPrice', { unit: t(`units.${bid.unit}`) })}
                    </span>
                    <p className="font-display text-base font-extrabold text-forest mt-0.5">
                      {formatMoney(bid.pricePerUnit, locale)}
                    </p>
                  </div>
                  <div>
                    <span className="text-soil font-medium">
                      {t('bid.offerQuantity', { unit: t(`units.${bid.unit}`) })}
                    </span>
                    <p className="font-display text-base font-extrabold text-forest mt-0.5">
                      {formatQty(bid.quantity, t(`units.${bid.unit}`), locale)}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-forest/10">
                    <span className="text-soil font-medium">{t('bid.totalValue')}</span>
                    <p className="font-display text-base font-extrabold text-leaf mt-0.5">
                      {formatMoney(bid.priceTotal, locale)}
                    </p>
                  </div>
                </div>

                {/* Buyer / Farmer Notes */}
                {bid.notes ? (
                  <p className="text-xs text-ink/75 italic bg-cream/50 rounded-lg p-2 border border-forest/5 mb-3">
                    {bid.notes}
                  </p>
                ) : null}

                {/* Counter-Offer Action Banner */}
                {isCountered && bid.counterPrice ? (
                  <div className="rounded-xl border border-harvest/40 bg-harvest/15 p-3.5 mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-forest uppercase tracking-wider">
                          <span aria-hidden="true">🤝</span>
                          <span>{t('bid.counterOfferLabel')}</span>
                        </div>
                        <p className="font-display text-xl font-extrabold text-forest mt-0.5">
                          {formatMoney(bid.counterPrice, locale)}
                          <span className="text-xs font-normal text-soil ml-1">
                            / {t(`units.${bid.unit}`)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleAcceptCounter(bid.id)}
                          disabled={isActionBusy}
                          className="font-bold shadow-sm text-xs py-2 px-3.5"
                        >
                          {isActionBusy ? '...' : t('bid.acceptCounter')}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleWithdraw(bid.id)}
                          disabled={isActionBusy}
                          className="text-xs py-2 px-3 text-clay hover:bg-clay/10"
                        >
                          {t('bid.withdrawCta')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Accepted Order Callout */}
                {isAccepted && bid.orderId ? (
                  <div className="flex items-center justify-between rounded-xl border border-leaf/30 bg-leaf/10 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-forest">
                      <span aria-hidden="true">✔</span>
                      <span>{t('bid.orderCreatedNotice')}</span>
                    </div>
                    <Link href={`/orders/${bid.orderId}`}>
                      <Button className="text-xs font-bold py-1.5 px-3">
                        {t('order.openCta')} →
                      </Button>
                    </Link>
                  </div>
                ) : null}

                {/* Pending Bid Actions */}
                {isPending ? (
                  <div className="flex items-center justify-between border-t border-forest/8 pt-3 text-xs">
                    <span className="text-ink/65 italic flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-harvest animate-pulse" />
                      {t('bid.status.pending')}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => handleWithdraw(bid.id)}
                      disabled={isActionBusy}
                      className="text-xs py-1 px-3 text-clay hover:bg-clay/10 font-medium"
                    >
                      {isActionBusy ? '...' : t('bid.withdrawCta')}
                    </Button>
                  </div>
                ) : null}

                {/* Closed Bid Link Back */}
                {(bid.status === 'rejected' || bid.status === 'withdrawn') && bid.listingId ? (
                  <div className="flex items-center justify-end border-t border-forest/8 pt-2">
                    <Link
                      href={`/listings/${bid.listingId}`}
                      className="text-xs font-bold text-forest hover:text-leaf hover:underline"
                    >
                      {t('bid.tabMakeOffer')} →
                    </Link>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
