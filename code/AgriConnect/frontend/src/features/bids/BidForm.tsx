'use client';

import { type FormEvent, useState } from 'react';
import { Alert, Badge, Button, Field, Input, Textarea } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { createBid } from '@/lib/api/bids';
import { getErrorMessage } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format';
import type { Bid, Unit } from '@/lib/api/types';
import type { MessageKey } from '@/lib/i18n';

interface BidFormProps {
  listing: {
    id: string;
    crop: string;
    unit: Unit;
    pricePerUnit: string;
    quantity: string;
    minimumOrderQuantity: string;
  };
  onBidPlaced?: (bid: Bid) => void;
}

export function BidForm({ listing, onBidPlaced }: BidFormProps) {
  const { locale, t } = useLocale();
  const [offerPrice, setOfferPrice] = useState(listing.pricePerUnit);
  const [quantity, setQuantity] = useState(listing.minimumOrderQuantity);
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const numPrice = Number(offerPrice) || 0;
  const numQty = Number(quantity) || 0;
  const totalValue = numPrice * numQty;

  const askingNum = Number(listing.pricePerUnit) || 1;
  const pctDiff = ((numPrice - askingNum) / askingNum) * 100;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (numPrice <= 0 || numQty <= 0) return;

    setPending(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await createBid({
        listingId: listing.id,
        pricePerUnit: String(numPrice),
        quantity: String(numQty),
        notes: notes.trim() || undefined,
      });

      setSuccess(
        t('bid.successBody', {
          price: formatMoney(data.pricePerUnit, locale),
          qty: data.quantity,
          unit: t(`units.${data.unit}` as MessageKey),
        }),
      );
      setNotes('');
      onBidPlaced?.(data);
    } catch (cause) {
      setError(getErrorMessage(cause, t('common.errorGeneric')));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="warn">{error}</Alert> : null}
      {success ? <Alert tone="good">{success}</Alert> : null}

      <Field label={t('bid.offerPrice', { unit: t(`units.${listing.unit}` as MessageKey) })}>
        <Input
          type="number"
          step="0.5"
          min="1"
          required
          value={offerPrice}
          onChange={(e) => setOfferPrice(e.target.value)}
          placeholder={listing.pricePerUnit}
        />
      </Field>

      {/* Fairness Indicator Chip */}
      {numPrice > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-forest/10 bg-sand/15 p-2.5 text-xs text-ink/80">
          <span className="font-bold text-forest">{t('bid.mandiFairness')}:</span>
          {pctDiff >= 0 ? (
            <Badge tone="good">
              {pctDiff === 0 ? t('bid.fairOffer') : `+${pctDiff.toFixed(0)}% (${t('bid.aboveMandi')})`}
            </Badge>
          ) : pctDiff >= -15 ? (
            <Badge tone="good">
              {pctDiff.toFixed(0)}% · {t('bid.fairOffer')}
            </Badge>
          ) : (
            <Badge tone="warn">
              {pctDiff.toFixed(0)}% · {t('bid.belowMandi')}
            </Badge>
          )}
        </div>
      ) : null}

      <Field label={t('bid.offerQuantity', { unit: t(`units.${listing.unit}` as MessageKey) })}>
        <Input
          type="number"
          step="0.1"
          min={listing.minimumOrderQuantity}
          max={listing.quantity}
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </Field>

      {/* Computed Total Deal Value */}
      <div className="rounded-xl border border-leaf/20 bg-leaf/5 p-3.5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-soil">
          {t('bid.totalValue')}
        </span>
        <span className="font-display text-xl font-extrabold text-forest">
          {formatMoney(totalValue, locale)}
        </span>
      </div>

      <Field label={t('listing.place.notes')}>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('bid.notesPlaceholder')}
        />
      </Field>

      <Button
        type="submit"
        disabled={pending || numPrice <= 0 || numQty <= 0}
        className="w-full text-base font-bold py-3.5 shadow-md shadow-leaf/20 hover:shadow-lg transition-all"
      >
        {pending ? t('bid.submitting') : t('bid.submitOffer')}
      </Button>
    </form>
  );
}
