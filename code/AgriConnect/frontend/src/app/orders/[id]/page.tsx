'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { OrderTimeline } from '@/features/orders/OrderTimeline';
import { OrderCallPanel } from '@/features/calls/OrderCallPanel';
import { OrderChat } from '@/features/messages/OrderChat';
import { OrderPaymentPanel } from '@/features/payments/OrderPaymentPanel';
import { OrderReviewSection } from '@/features/reviews/OrderReviewSection';
import { useAuth } from '@/features/auth/auth-context';
import { useLocale } from '@/features/i18n/locale-context';
import { Alert, Badge, Button, Card, Field, Spinner, Textarea } from '@/components/ui';
import { getOrder, updateOrderStatus, updateOrderLogistics } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import type { MessageKey } from '@/lib/i18n';
import type { Order, OrderStatus } from '@/lib/api/types';

function nextActions(order: Order, userId: string, role: string) {
  const actions: Array<{ status: OrderStatus; labelKey: MessageKey; needsReason?: boolean }> = [];
  if (role === 'FARMER' && order.farmerId === userId) {
    if (order.status === 'pending') {
      actions.push({ status: 'accepted', labelKey: 'order.actions.accept' });
    }
    if (order.status === 'accepted') {
      actions.push({ status: 'confirmed', labelKey: 'order.actions.confirm' });
    }
    if (order.status === 'confirmed') {
      actions.push({ status: 'fulfilled', labelKey: 'order.actions.fulfil' });
    }
    if (['pending', 'accepted', 'confirmed'].includes(order.status)) {
      actions.push({ status: 'cancelled', labelKey: 'order.actions.cancel', needsReason: true });
    }
  }
  if (role === 'BUYER' && order.buyerId === userId && order.status === 'pending') {
    actions.push({ status: 'cancelled', labelKey: 'order.actions.cancelOrder', needsReason: true });
  }
  if (role === 'ADMIN' && ['pending', 'accepted', 'confirmed'].includes(order.status)) {
    actions.push({ status: 'cancelled', labelKey: 'order.actions.adminCancel', needsReason: true });
  }
  return actions;
}

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void getOrder(params.id)
      .then((result) => setOrder(result.data))
      .catch((cause) => setError(getErrorMessage(cause)));
  }, [params.id]);

  async function changeStatus(status: OrderStatus, form?: FormData) {
    if (!order) return;
    setPending(true);
    setError('');
    try {
      const { data } = await updateOrderStatus(order.id, {
        status,
        cancellationReason:
          status === 'cancelled' ? String(form?.get('cancellationReason') ?? '') : undefined,
      });
      setOrder(data);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  if (error && !order) return <Alert>{error}</Alert>;
  if (!order || !user) return <Spinner />;

  const actions = nextActions(order, user.id, user.role);
  const counterparty =
    user.id === order.buyerId
      ? { name: order.farmer?.name ?? t('order.farmer'), id: order.farmerId }
      : { name: order.buyer?.name ?? t('order.buyer'), id: order.buyerId };
  const counterpartyRating =
    user.id === order.buyerId ? order.farmer?.ratingAvg : order.buyer?.ratingAvg;
  const chatDisabled = order.status === 'cancelled';
  const isFarmer = user.role === 'FARMER' && order.farmerId === user.id;
  const isBuyer = user.role === 'BUYER' && order.buyerId === user.id;
  // Fulfilling releases escrow, so warn the farmer when there is no escrow to release.
  // Cash on delivery is collected in person and never holds anything.
  const escrowWarning =
    isFarmer &&
    actions.some((action) => action.status === 'fulfilled') &&
    order.payment?.status !== 'held' &&
    order.payment?.method !== 'cod';
  // Admins can read the thread for moderation but never join a call.
  const canCall = isFarmer || isBuyer;

  async function advanceLogistics(status: 'dispatched' | 'in_transit' | 'delivered') {
    setPending(true);
    setError('');
    try {
      const { data } = await updateOrderLogistics(order!.id, { logisticsStatus: status });
      setOrder(data);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  async function refreshOrder() {
    const refreshed = await getOrder(order!.id);
    setOrder(refreshed.data);
  }

  const unit = t(`units.${order.unit}`);

  const statusTone: Record<OrderStatus, 'neutral' | 'good' | 'warn' | 'bad'> = {
    pending: 'neutral',
    accepted: 'warn',
    confirmed: 'warn',
    fulfilled: 'good',
    cancelled: 'bad',
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-4">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
              {order.listing?.crop ?? t('order.titleFallback')}
            </h1>
            <Badge tone={statusTone[order.status]}>{t(`order.status.${order.status}`)}</Badge>
          </div>

          <div className="rounded-xl border border-leaf/20 bg-leaf/5 p-4 sm:p-5">
            <p className="font-display text-3xl font-extrabold text-forest sm:text-4xl">
              {formatMoney(order.priceTotal, locale)}
            </p>
            <p className="mt-1 text-sm font-medium text-ink/75 sm:text-base">
              {t('order.quantityLine', {
                qty: formatQty(order.quantity, unit, locale),
                price: formatMoney(order.pricePerUnit, locale),
                unit,
              })}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-forest/10 bg-sand/15 p-4 text-sm text-ink/80">
            <p>{t('order.deliveryLine', { mode: t(`order.deliveryMode.${order.deliveryMode}`) })}</p>
            <p>{t('order.placedLine', { date: formatDate(order.createdAt, locale) })}</p>
            {order.notes ? <p>{t('order.notesLine', { notes: order.notes })}</p> : null}
            {order.cancellationReason ? (
              <p className="font-medium text-clay">
                {t('order.cancelledLine', { reason: order.cancellationReason })}
              </p>
            ) : null}
          </div>

          {error ? <Alert>{error}</Alert> : null}
          {escrowWarning ? <Alert>{t('order.escrowNotHeld')}</Alert> : null}

          {isFarmer && order.deliveryMode === 'delivery' && order.status !== 'cancelled' ? (
            <div className="flex flex-wrap gap-2.5 pt-2">
              {order.logisticsStatus === 'none' ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void advanceLogistics('dispatched')}
                >
                  {t('order.actions.dispatch')}
                </Button>
              ) : null}
              {order.logisticsStatus === 'dispatched' ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void advanceLogistics('in_transit')}
                >
                  {t('order.actions.transit')}
                </Button>
              ) : null}
              {['dispatched', 'in_transit'].includes(order.logisticsStatus ?? 'none') ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void advanceLogistics('delivered')}
                >
                  {t('order.actions.deliver')}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-2">
            {actions.map((action) =>
              action.needsReason ? (
                <form
                  key={action.status}
                  className="space-y-3 rounded-xl border border-clay/20 bg-clay/5 p-4"
                  action={(form) => void changeStatus(action.status, form)}
                >
                  <Field label={t('order.cancellationReason')}>
                    <Textarea name="cancellationReason" required />
                  </Field>
                  <Button type="submit" variant="danger" disabled={pending}>
                    {t(action.labelKey)}
                  </Button>
                </form>
              ) : (
                <Button
                  key={action.status}
                  type="button"
                  disabled={pending}
                  onClick={() => void changeStatus(action.status)}
                >
                  {t(action.labelKey)}
                </Button>
              ),
            )}
          </div>
        </Card>

        <OrderTimeline order={order} />

        {order.status === 'fulfilled' ? (
          <OrderReviewSection
            orderId={order.id}
            counterpartyName={counterparty.name}
            counterpartyRating={counterpartyRating}
          />
        ) : null}
      </div>

      <div className="space-y-6 lg:col-span-5">
        <OrderPaymentPanel order={order} isBuyer={isBuyer} onUpdated={refreshOrder} />

        {canCall ? (
          <OrderCallPanel
            orderId={order.id}
            counterpartyName={counterparty.name}
            disabled={chatDisabled}
          />
        ) : null}

        <OrderChat orderId={order.id} userId={user.id} disabled={chatDisabled} />

        <p className="rounded-xl border border-forest/10 bg-forest/[0.02] p-3 text-center text-xs text-ink/65">
          {t('order.footerHint', { call: t('order.call.title'), kisan: t('kisan.title') })}
        </p>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderDetail />
    </RequireAuth>
  );
}
