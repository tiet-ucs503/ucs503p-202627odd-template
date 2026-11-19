'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Spinner } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { acceptBid, counterBid, listIncomingBids, listListingBids, rejectBid } from '@/lib/api/bids';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import type { Bid } from '@/lib/api/types';

interface FarmerBidsListProps {
  listingId?: string;
  compact?: boolean;
}

type FarmerFilterTab = 'all' | 'needs_action' | 'countered' | 'accepted' | 'closed';

const statusTones = {
  pending: 'warn',
  accepted: 'good',
  rejected: 'bad',
  countered: 'gold',
  withdrawn: 'neutral',
} as const;

export function FarmerBidsList({ listingId, compact }: FarmerBidsListProps = {}) {
  const { locale, t } = useLocale();
  const [bids, setBids] = useState<Bid[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [createdOrderNotice, setCreatedOrderNotice] = useState<{ bidId: string; orderId: string } | null>(null);
  const [counterOpenId, setCounterOpenId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [filter, setFilter] = useState<FarmerFilterTab>('all');

  const loadBids = useCallback(async () => {
    try {
      if (listingId) {
        const { data } = await listListingBids(listingId);
        setBids(data);
      } else {
        const { data } = await listIncomingBids({ limit: 50 });
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
          const { data } = await listIncomingBids({ limit: 50 });
          if (mounted) setBids(data);
        }
      } catch (cause) {
        if (mounted) {
          setLoadError(getErrorMessage(cause, t('common.errorGeneric')));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void initLoad();
    return () => {
      mounted = false;
    };
  }, [listingId, t]);

  async function handleAccept(bidId: string) {
    setActionPendingId(bidId);
    setActionError('');
    try {
      const { data } = await acceptBid(bidId);
      setCreatedOrderNotice({ bidId, orderId: data.order.id });
      await loadBids();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleReject(bidId: string) {
    setActionPendingId(bidId);
    setActionError('');
    try {
      await rejectBid(bidId);
      await loadBids();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleCounter(bidId: string) {
    if (!counterPrice || Number(counterPrice) <= 0) return;
    setActionPendingId(bidId);
    setActionError('');
    try {
      await counterBid(bidId, { counterPrice });
      setCounterOpenId(null);
      setCounterPrice('');
      await loadBids();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPendingId(null);
    }
  }

  if (loading) return <Spinner />;
  if (loadError && !bids) {
    return (
      <Alert tone="warn">
        <p className="text-sm font-semibold">{loadError}</p>
      </Alert>
    );
  }

  const allBids = bids ?? [];

  // Filter logic
  const filteredBids = allBids.filter((bid) => {
    if (filter === 'needs_action') return bid.status === 'pending';
    if (filter === 'countered') return bid.status === 'countered';
    if (filter === 'accepted') return bid.status === 'accepted';
    if (filter === 'closed') return bid.status === 'rejected' || bid.status === 'withdrawn';
    return true;
  });

  const needsActionCount = allBids.filter((b) => b.status === 'pending').length;
  const counteredCount = allBids.filter((b) => b.status === 'countered').length;
  const acceptedCount = allBids.filter((b) => b.status === 'accepted').length;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl font-bold text-forest">
            {t('bid.farmerIncomingTitle')}
          </h3>
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-bold text-forest">
            {allBids.length}
          </span>
        </div>

        {!listingId && compact ? (
          <Link
            href="/farmer/bids"
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
            {t('bid.farmerIncomingTitle')} ({allBids.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('needs_action')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filter === 'needs_action'
                ? 'bg-forest text-paper shadow-sm font-bold'
                : 'text-forest/70 hover:text-forest'
            }`}
          >
            <span>{t('bid.status.pending')}</span>
            {needsActionCount > 0 ? (
              <span className="rounded-full bg-harvest px-1.5 py-0.2 text-[10px] text-ink font-extrabold">
                {needsActionCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setFilter('countered')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'countered'
                ? 'bg-forest text-paper shadow-sm font-bold'
                : 'text-forest/70 hover:text-forest'
            }`}
          >
            {t('bid.status.countered')} ({counteredCount})
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

      {/* Action Error Notice */}
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
            aria-label={t('weather.closeDetails')}
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Created Order Callout */}
      {createdOrderNotice ? (
        <div className="flex items-center justify-between rounded-xl border border-leaf/30 bg-leaf/10 p-3 text-xs text-forest">
          <div className="flex items-center gap-2 font-bold">
            <span aria-hidden="true">✔</span>
            <span>{t('bid.orderCreatedNotice')}</span>
          </div>
          <Link
            href={`/orders/${createdOrderNotice.orderId}`}
            className="font-bold underline hover:text-leaf"
          >
            {t('order.openCta')} →
          </Link>
        </div>
      ) : null}

      {/* Empty States */}
      {allBids.length === 0 ? (
        <EmptyState
          title={t('bid.noBidsTitle')}
          body={t('bid.noBidsBody')}
        />
      ) : filteredBids.length === 0 ? (
        <div className="rounded-xl border border-forest/10 bg-sand/15 p-8 text-center text-ink/70">
          <p className="text-sm font-semibold">{t('bid.noBidsTitle')}</p>
          <Button
            variant="ghost"
            onClick={() => setFilter('all')}
            className="mt-2 text-xs font-bold text-leaf"
          >
            {t('bid.farmerIncomingTitle')} ({allBids.length})
          </Button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredBids.map((bid) => {
            const isPending = bid.status === 'pending';
            const isCountered = bid.status === 'countered';
            const isAccepted = bid.status === 'accepted';
            const isActionBusy = actionPendingId === bid.id;

            return (
              <Card
                key={bid.id}
                className={`p-4 sm:p-5 transition-all ${
                  isPending
                    ? 'border-forest/20 shadow-xs'
                    : 'border-forest/15'
                }`}
              >
                {/* Header: Crop name & Status */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-forest/8 pb-3">
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
                    <p className="font-semibold text-forest text-sm mt-0.5">
                      {bid.buyer?.businessName ? `${bid.buyer.businessName} (${bid.buyer.name})` : bid.buyer?.name}
                    </p>
                    <p className="text-xs text-ink/60">
                      {formatDate(bid.createdAt, locale)}
                    </p>
                  </div>
                  <Badge tone={statusTones[bid.status]}>
                    {t(`bid.status.${bid.status}`)}
                  </Badge>
                </div>

                {/* Offer Numbers */}
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

                {/* Buyer Notes */}
                {bid.notes ? (
                  <p className="text-xs text-ink/75 italic bg-cream/50 rounded-lg p-2 border border-forest/5 mb-3">
                    {bid.notes}
                  </p>
                ) : null}

                {/* Counter-Offer Sent Banner */}
                {isCountered && bid.counterPrice ? (
                  <div className="rounded-xl border border-harvest/30 bg-harvest/10 p-3 mb-3 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-forest">{t('bid.counterSent')}</span>{' '}
                      <span className="font-extrabold text-forest">{formatMoney(bid.counterPrice, locale)}</span>
                      <span className="text-soil ml-1">/ {t(`units.${bid.unit}`)}</span>
                    </div>
                    <span className="text-ink/60 italic">
                      {t('bid.status.countered')}
                    </span>
                  </div>
                ) : null}

                {/* Accepted Order Direct Link */}
                {isAccepted && bid.orderId ? (
                  <div className="flex items-center justify-between border-t border-forest/8 pt-3">
                    <span className="text-xs text-leaf font-bold flex items-center gap-1.5">
                      <span aria-hidden="true">✔</span>
                      {t('bid.status.accepted')}
                    </span>
                    <Link
                      href={`/orders/${bid.orderId}`}
                      className="text-xs font-bold text-forest hover:text-leaf hover:underline flex items-center gap-1"
                    >
                      <span>{t('order.openCta')}</span> →
                    </Link>
                  </div>
                ) : null}

                {/* Pending Actions / Counter Drawer */}
                {isPending ? (
                  <div className="pt-2 border-t border-forest/8 space-y-3">
                    {counterOpenId === bid.id ? (
                      <div className="space-y-3 rounded-xl border border-forest/15 bg-sand/15 p-3.5">
                        <Field label={t('bid.counterPrompt', { unit: t(`units.${bid.unit}`) })}>
                          <Input
                            type="number"
                            step="0.5"
                            value={counterPrice}
                            onChange={(e) => setCounterPrice(e.target.value)}
                            placeholder={t('bid.counterPlaceholder', { unit: t(`units.${bid.unit}`) })}
                          />
                        </Field>

                        {Number(counterPrice) > 0 ? (
                          <div className="flex justify-between items-center text-xs bg-cream/70 p-2 rounded-lg border border-forest/8">
                            <span className="text-soil font-medium">{t('bid.totalValue')}:</span>
                            <span className="font-display font-extrabold text-leaf">
                              {formatMoney(String(Number(counterPrice) * Number(bid.quantity)), locale)}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleCounter(bid.id)}
                            disabled={isActionBusy || !counterPrice || Number(counterPrice) <= 0}
                            className="flex-1 py-2 text-xs font-bold"
                          >
                            {isActionBusy ? '...' : t('bid.sendCounter')}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setCounterOpenId(null)}
                            disabled={isActionBusy}
                            className="py-2 text-xs"
                          >
                            {t('bid.cancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => handleAccept(bid.id)}
                          disabled={isActionBusy}
                          className="flex-1 py-2 text-xs font-bold shadow-sm"
                        >
                          {isActionBusy ? '...' : t('bid.acceptCta')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setCounterOpenId(bid.id);
                            setCounterPrice(bid.pricePerUnit);
                          }}
                          disabled={isActionBusy}
                          className="py-2 text-xs font-semibold"
                        >
                          {t('bid.counterCta')}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleReject(bid.id)}
                          disabled={isActionBusy}
                          className="py-2 text-xs text-clay hover:bg-clay/10"
                        >
                          {isActionBusy ? '...' : t('bid.rejectCta')}
                        </Button>
                      </div>
                    )}
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
