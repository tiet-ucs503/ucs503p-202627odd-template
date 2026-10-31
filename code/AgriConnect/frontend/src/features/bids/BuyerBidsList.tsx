'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { acceptBid, listListingBids, listMyBids, withdrawBid } from '@/lib/api/bids';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import type { Bid } from '@/lib/api/types';

interface BuyerBidsListProps {
  listingId?: string;
  onBidChanged?: () => void;
}

const statusTones = {
  pending: 'warn',
  accepted: 'good',
  rejected: 'bad',
  countered: 'gold',
  withdrawn: 'neutral',
} as const;

export function BuyerBidsList({ listingId, onBidChanged }: BuyerBidsListProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [bids, setBids] = useState<Bid[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionPending, setActionPending] = useState(false);

  async function loadBids() {
    try {
      if (listingId) {
        const { data } = await listListingBids(listingId);
        setBids(data);
      } else {
        const { data } = await listMyBids({ limit: 50 });
        setBids(data);
      }
    } catch (cause) {
      setError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (listingId) {
          const { data } = await listListingBids(listingId);
          if (mounted) setBids(data);
        } else {
          const { data } = await listMyBids({ limit: 50 });
          if (mounted) setBids(data);
        }
      } catch (cause) {
        if (mounted) setError(getErrorMessage(cause, t('common.errorGeneric')));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [listingId, t]);

  async function handleWithdraw(bidId: string) {
    setActionPending(true);
    setError('');
    try {
      await withdrawBid(bidId);
      void loadBids();
      onBidChanged?.();
    } catch (cause) {
      setError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPending(false);
    }
  }

  async function handleAcceptCounter(bidId: string) {
    setActionPending(true);
    setError('');
    try {
      await acceptBid(bidId);
      void loadBids();
      onBidChanged?.();
    } catch (cause) {
      setError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <Alert tone="warn">{error}</Alert>;
  if (!bids || bids.length === 0) {
    if (listingId) return null;
    return (
      <EmptyState
        title={t('bid.noBidsTitle')}
        body={t('bid.noBidsBody')}
        action={
          <Button onClick={() => router.push('/marketplace')} className="font-bold">
            {t('nav.browse')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-forest">
        {listingId ? t('bid.status.pending') : t('bid.buyerSectionTitle')} ({bids.length})
      </h4>

      <div className="space-y-2.5">
        {bids.map((bid) => (
          <Card key={bid.id} className="p-3.5 border-forest/15 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                {bid.listing ? (
                  <p className="font-bold text-forest text-sm">
                    {bid.listing.crop}
                  </p>
                ) : null}
                <p className="text-ink/65 text-xs">
                  {formatDate(bid.createdAt, locale)}
                </p>
              </div>
              <Badge tone={statusTones[bid.status]}>
                {t(`bid.status.${bid.status}`)}
              </Badge>
            </div>

            <div className="flex justify-between items-center bg-sand/15 p-2 rounded-lg">
              <span>
                <span className="font-semibold text-soil">{t('bid.offerPrice', { unit: t(`units.${bid.unit}`) })}:</span>{' '}
                <span className="font-bold text-forest">{formatMoney(bid.pricePerUnit, locale)}</span>
              </span>
              <span>
                <span className="font-semibold text-soil">{t('bid.offerQuantity', { unit: t(`units.${bid.unit}`) })}:</span>{' '}
                <span className="font-bold text-forest">{formatQty(bid.quantity, t(`units.${bid.unit}`), locale)}</span>
              </span>
            </div>

            {bid.status === 'countered' && bid.counterPrice ? (
              <div className="bg-harvest/15 p-2 rounded-lg border border-harvest/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-forest">{t('bid.counterOfferLabel')}</span>{' '}
                  <span className="font-extrabold text-forest">{formatMoney(bid.counterPrice, locale)}</span>
                </div>
                <Button
                  onClick={() => handleAcceptCounter(bid.id)}
                  disabled={actionPending}
                  className="py-1 px-3 text-xs font-bold"
                >
                  {t('bid.acceptCounter')}
                </Button>
              </div>
            ) : null}

            {bid.status === 'accepted' && bid.orderId ? (
              <Link
                href={`/orders/${bid.orderId}`}
                className="block text-xs font-bold text-leaf hover:underline mt-1"
              >
                {t('bid.orderCreatedNotice')} →
              </Link>
            ) : null}

            {(bid.status === 'pending' || bid.status === 'countered') ? (
              <div className="pt-1 flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => handleWithdraw(bid.id)}
                  disabled={actionPending}
                  className="py-1 px-2.5 text-xs text-clay"
                >
                  {t('bid.withdrawCta')}
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
