'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Spinner } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { acceptBid, counterBid, listListingBids, rejectBid } from '@/lib/api/bids';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import type { Bid } from '@/lib/api/types';

interface FarmerBidsListProps {
  listingId: string;
}

const statusTones = {
  pending: 'warn',
  accepted: 'good',
  rejected: 'bad',
  countered: 'gold',
  withdrawn: 'neutral',
} as const;

export function FarmerBidsList({ listingId }: FarmerBidsListProps) {
  const { locale, t } = useLocale();
  const [bids, setBids] = useState<Bid[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [createdOrderNotice, setCreatedOrderNotice] = useState<{ bidId: string; orderId: string } | null>(null);
  const [counterOpenId, setCounterOpenId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [actionPending, setActionPending] = useState(false);

  const loadBids = useCallback(async () => {
    try {
      const { data } = await listListingBids(listingId);
      setBids(data);
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setLoading(false);
    }
  }, [listingId, t]);

  useEffect(() => {
    let mounted = true;
    async function initLoad() {
      try {
        const { data } = await listListingBids(listingId);
        if (mounted) {
          setBids(data);
        }
      } catch (cause) {
        if (mounted) {
          setActionError(getErrorMessage(cause, t('common.errorGeneric')));
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
    setActionPending(true);
    setActionError('');
    try {
      const { data } = await acceptBid(bidId);
      setCreatedOrderNotice({ bidId, orderId: data.order.id });
      void loadBids();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPending(false);
    }
  }

  async function handleReject(bidId: string) {
    setActionPending(true);
    setActionError('');
    try {
      await rejectBid(bidId);
      void loadBids();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPending(false);
    }
  }

  async function handleCounter(bidId: string) {
    if (!counterPrice || Number(counterPrice) <= 0) return;
    setActionPending(true);
    setActionError('');
    try {
      await counterBid(bidId, { counterPrice });
      setCounterOpenId(null);
      setCounterPrice('');
      void loadBids();
    } catch (cause) {
      setActionError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-forest/10 pb-3">
        <h3 className="font-display text-xl font-bold text-forest">
          {t('bid.farmerIncomingTitle')} ({bids?.length ?? 0})
        </h3>
      </div>

      {actionError ? <Alert tone="warn">{actionError}</Alert> : null}

      {createdOrderNotice ? (
        <Alert tone="good">
          <div className="space-y-2">
            <p className="font-bold">{t('bid.orderCreatedNotice')}</p>
            <Link
              href={`/orders/${createdOrderNotice.orderId}`}
              className="inline-flex items-center font-bold text-forest underline hover:text-leaf"
            >
              {t('order.openCta')} →
            </Link>
          </div>
        </Alert>
      ) : null}

      {!bids || bids.length === 0 ? (
        <EmptyState
          title={t('bid.noBidsTitle')}
          body={t('bid.noBidsBody')}
        />
      ) : (
        <div className="space-y-3.5">
          {bids.map((bid) => (
            <Card key={bid.id} className="p-4 sm:p-5 border-forest/15 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-forest text-base">
                    {bid.buyer?.businessName ? `${bid.buyer.businessName} (${bid.buyer.name})` : bid.buyer?.name}
                  </p>
                  <p className="text-xs text-ink/65 mt-0.5">
                    {formatDate(bid.createdAt, locale)}
                  </p>
                </div>
                <Badge tone={statusTones[bid.status]}>
                  {t(`bid.status.${bid.status}`)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-sand/15 p-3 text-xs">
                <div>
                  <span className="text-soil font-semibold">{t('bid.offerPrice', { unit: t(`units.${bid.unit}`) })}:</span>
                  <p className="font-display text-base font-extrabold text-forest mt-0.5">
                    {formatMoney(bid.pricePerUnit, locale)}
                  </p>
                </div>
                <div>
                  <span className="text-soil font-semibold">{t('bid.offerQuantity', { unit: t(`units.${bid.unit}`) })}:</span>
                  <p className="font-display text-base font-extrabold text-forest mt-0.5">
                    {formatQty(bid.quantity, t(`units.${bid.unit}`), locale)}
                  </p>
                </div>
                <div className="col-span-2 pt-1 border-t border-forest/10 flex justify-between items-center">
                  <span className="text-soil font-semibold">{t('bid.totalValue')}:</span>
                  <span className="font-display text-base font-extrabold text-leaf">
                    {formatMoney(bid.priceTotal, locale)}
                  </span>
                </div>
              </div>

              {bid.notes ? (
                <p className="text-xs text-ink/80 bg-paper rounded-lg p-2 border border-forest/10 italic">
                  {bid.notes}
                </p>
              ) : null}

              {bid.status === 'countered' && bid.counterPrice ? (
                <p className="text-xs font-semibold text-harvest bg-harvest/10 p-2 rounded-lg">
                  {t('bid.counterSent')} {formatMoney(bid.counterPrice, locale)} / {t(`units.${bid.unit}`)}
                </p>
              ) : null}

              {bid.status === 'accepted' && bid.orderId ? (
                <div className="pt-2">
                  <Link
                    href={`/orders/${bid.orderId}`}
                    className="text-xs font-bold text-leaf hover:underline flex items-center gap-1"
                  >
                    <span>{t('order.openCta')}</span> →
                  </Link>
                </div>
              ) : null}

              {bid.status === 'pending' ? (
                <div className="pt-2 space-y-2">
                  {counterOpenId === bid.id ? (
                    <div className="space-y-2 border-t border-forest/10 pt-2">
                      <Field label={t('bid.counterPrompt', { unit: t(`units.${bid.unit}`) })}>
                        <Input
                          type="number"
                          step="0.5"
                          value={counterPrice}
                          onChange={(e) => setCounterPrice(e.target.value)}
                          placeholder={t('bid.counterPlaceholder', { unit: t(`units.${bid.unit}`) })}
                        />
                      </Field>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCounter(bid.id)}
                          disabled={actionPending}
                          className="flex-1 py-2 text-xs font-bold"
                        >
                          {t('bid.sendCounter')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setCounterOpenId(null)}
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
                        disabled={actionPending}
                        className="flex-1 py-2 text-xs font-bold"
                      >
                        {t('bid.acceptCta')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setCounterOpenId(bid.id);
                          setCounterPrice(bid.pricePerUnit);
                        }}
                        disabled={actionPending}
                        className="py-2 text-xs font-semibold"
                      >
                        {t('bid.counterCta')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleReject(bid.id)}
                        disabled={actionPending}
                        className="py-2 text-xs text-clay"
                      >
                        {t('bid.rejectCta')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
