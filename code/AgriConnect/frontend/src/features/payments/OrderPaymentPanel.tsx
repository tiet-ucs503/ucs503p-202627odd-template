'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, cx } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { getErrorMessage } from '@/lib/api/errors';
import {
  confirmOrderPaymentHeld,
  initOrderPayment,
  listPaymentMethods,
  type InitPaymentResult,
} from '@/lib/api/orders';
import { formatMoney } from '@/lib/format';
import type { MessageKey } from '@/lib/i18n';
import type { Order, PaymentMethod, PaymentMethodOption } from '@/lib/api/types';
import { openRazorpayCheckout, type CheckoutErrorCode } from './razorpay';

/** Statuses where the buyer has nothing left to pay. */
const SETTLED = new Set(['held', 'released', 'refunded']);

const CHECKOUT_ERROR_KEYS: Record<CheckoutErrorCode, MessageKey> = {
  'not-configured': 'order.payment.errors.notConfigured',
  'load-failed': 'order.payment.errors.loadFailed',
  cancelled: 'order.payment.errors.cancelled',
  failed: 'order.payment.errors.failed',
};

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

function statusCopy(order: Order, t: Translate): { tone: 'good' | 'warn' | 'bad' | 'neutral'; text: string } {
  const payment = order.payment;
  if (!payment) {
    return { tone: 'neutral', text: t('order.payment.noneStarted') };
  }
  switch (payment.status) {
    case 'held':
      return { tone: 'good', text: t('order.payment.heldNote') };
    case 'released':
      return { tone: 'good', text: t('order.payment.releasedNote') };
    case 'refunded':
      return { tone: 'warn', text: t('order.payment.refundedNote') };
    case 'failed':
      return {
        tone: 'bad',
        text: payment.failureReason ?? t('order.payment.failedNote'),
      };
    case 'authorized':
      return { tone: 'warn', text: t('order.payment.authorizedNote') };
    default:
      return payment.method === 'cod'
        ? { tone: 'warn', text: t('order.payment.codNote') }
        : { tone: 'warn', text: t('order.payment.pendingNote') };
  }
}

export function OrderPaymentPanel({
  order,
  isBuyer,
  onUpdated,
}: {
  order: Order;
  isBuyer: boolean;
  onUpdated: () => void | Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [chosen, setChosen] = useState<PaymentMethod | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const payment = order.payment;
  const cancelled = order.status === 'cancelled';
  // A pending cash-on-delivery choice stays changeable: the API re-opens any pending
  // payment, so a mis-tapped COD must not leave the buyer unable to pay online.
  const canPay = isBuyer && !cancelled && (!payment || !SETTLED.has(payment.status));
  // What this session picked wins; otherwise show the method already on the order, so a
  // buyer revisiting a pending payment sees their own choice rather than the default.
  const selected: PaymentMethod = chosen ?? payment?.method ?? 'upi';

  useEffect(() => {
    if (!canPay) return;
    void listPaymentMethods()
      .then((result) => setMethods(result.data))
      .catch(() => setMethods([]));
  }, [canPay]);

  async function afterSettled(message: string) {
    setNotice(message);
    await onUpdated();
  }

  async function handleGatewayResult(result: InitPaymentResult) {
    if (result.mode === 'cod') {
      // The API message is English-only, so the localized copy wins here.
      await afterSettled(t('order.payment.codSelected'));
      return;
    }

    if (result.mode === 'mock') {
      // No gateway keys configured, so simulate the escrow hold end to end.
      await confirmOrderPaymentHeld(order.id);
      await afterSettled(t('order.payment.simulated'));
      return;
    }

    const checkout = await openRazorpayCheckout({
      keyId: result.keyId ?? '',
      razorpayOrderId: result.razorpayOrderId ?? '',
      amountPaise: Math.round(Number(result.amount) * 100),
      description: `AgriConnect order ${order.id.slice(0, 8)}`,
      method: selected,
    });
    if (!checkout.ok) {
      setError(t(CHECKOUT_ERROR_KEYS[checkout.error]));
      return;
    }
    await confirmOrderPaymentHeld(order.id, { providerRef: checkout.paymentId });
    await afterSettled(t('order.payment.receivedHeld'));
  }

  async function pay() {
    setPending(true);
    setError('');
    setNotice('');
    try {
      const { data } = await initOrderPayment(order.id, { method: selected });
      await handleGatewayResult(data);
    } catch (cause) {
      setError(getErrorMessage(cause));
      // A rejected confirmation leaves the payment `failed` server-side, so pull the
      // real status back instead of leaving the panel showing the old one.
      await onUpdated();
    } finally {
      setPending(false);
    }
  }

  const status = statusCopy(order, t);
  const escrowMethod = methods.find((option) => option.method === selected)?.escrow ?? true;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-forest">{t('order.payment.title')}</h2>
          <p className="text-sm text-ink/60">
            {t('order.payment.subtitle', { amount: formatMoney(order.priceTotal, locale) })}
          </p>
        </div>
        {payment ? (
          <Badge tone={status.tone}>
            {payment.method ? `${t(`order.payment.method.${payment.method}`)} · ` : ''}
            {t(`order.payment.state.${payment.status}`)}
          </Badge>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <p className="text-sm font-semibold text-forest">{notice}</p> : null}
      <p className="text-sm text-ink/70">{status.text}</p>

      {canPay ? (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-forest">
              {t('order.payment.chooseMethod')}
            </legend>
            {methods.map((option) => (
              <label
                key={option.method}
                className={cx(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 text-sm transition',
                  selected === option.method
                    ? 'border-leaf bg-leaf/5 ring-1 ring-leaf/30 shadow-xs'
                    : 'border-forest/10 bg-paper hover:border-forest/30 hover:bg-forest/[0.02]',
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.method}
                    checked={selected === option.method}
                    onChange={() => setChosen(option.method)}
                    className="h-4 w-4 accent-leaf"
                  />
                  <div>
                    <p className="font-semibold text-forest">
                      {t(`order.payment.method.${option.method}`)}
                    </p>
                    <p className="text-xs text-ink/65">
                      {option.escrow
                        ? t('order.payment.escrowProtected')
                        : t('order.payment.payOnDelivery')}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </fieldset>
          <Button type="button" disabled={pending || methods.length === 0} onClick={() => void pay()}>
            {escrowMethod ? t('order.payment.payAndHold') : t('order.payment.confirmCod')}
          </Button>
          <p className="text-xs text-ink/60">{t('order.payment.warning')}</p>
        </div>
      ) : null}
    </Card>
  );
}
