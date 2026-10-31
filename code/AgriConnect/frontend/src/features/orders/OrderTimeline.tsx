'use client';

import { useLocale } from '@/features/i18n/locale-context';
import type { Order } from '@/lib/api/types';
import { formatDate, formatMoney } from '@/lib/format';
import type { MessageKey } from '@/lib/i18n';

type StepState = 'complete' | 'current' | 'upcoming' | 'cancelled';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface TimelineStep {
  id: string;
  label: string;
  state: StepState;
  detail?: string;
}

const MAIN_KEYS = [
  'order.timeline.placed',
  'order.timeline.accepted',
  'order.timeline.confirmed',
  'order.timeline.fulfilled',
] as const satisfies readonly MessageKey[];

function mainStepState(stepIndex: number, order: Order): StepState {
  if (order.status === 'cancelled') {
    return stepIndex === 0 ? 'complete' : 'upcoming';
  }
  const statusIndex = { pending: 0, accepted: 1, confirmed: 2, fulfilled: 3 }[order.status] ?? 0;
  if (stepIndex < statusIndex) return 'complete';
  if (stepIndex === statusIndex) return 'current';
  return 'upcoming';
}

function paymentSteps(order: Order, t: Translate, locale: string): TimelineStep[] | null {
  const payment = order.payment;
  if (!payment && order.status === 'cancelled') return null;

  const steps: TimelineStep[] = [
    { id: 'pay-pending', label: t('order.timeline.paymentStep'), state: 'upcoming' },
    { id: 'pay-held', label: t('order.timeline.escrowHeld'), state: 'upcoming' },
    { id: 'pay-released', label: t('order.timeline.released'), state: 'upcoming' },
  ];

  if (!payment) {
    steps[0].state = order.status === 'pending' ? 'current' : 'upcoming';
    steps[0].detail = t('order.timeline.awaitingPayment');
    return steps;
  }

  const status = payment.status;
  if (status === 'pending' || status === 'authorized') {
    steps[0].state = 'current';
    steps[0].detail = formatMoney(payment.amount, locale);
  } else if (status === 'held') {
    steps[0].state = 'complete';
    steps[1].state = 'current';
    steps[1].detail = formatMoney(payment.amount, locale);
  } else if (status === 'released') {
    steps[0].state = 'complete';
    steps[1].state = 'complete';
    steps[2].state = 'complete';
    steps[2].detail = formatMoney(payment.amount, locale);
  } else if (status === 'refunded' || status === 'failed') {
    steps[0].state = 'complete';
    steps[1].state = 'cancelled';
    steps[1].detail = t(`order.payment.state.${status}`);
    return steps;
  }

  return steps;
}

function logisticsSteps(order: Order, t: Translate, locale: string): TimelineStep[] | null {
  if (order.deliveryMode !== 'delivery') return null;
  if (order.status === 'cancelled') return null;

  const logistics = order.logisticsStatus ?? 'none';
  const steps: TimelineStep[] = [
    { id: 'log-dispatched', label: t('order.timeline.dispatched'), state: 'upcoming', detail: order.dispatchedAt ? formatDate(order.dispatchedAt, locale) : undefined },
    { id: 'log-transit', label: t('order.timeline.inTransit'), state: 'upcoming', detail: order.inTransitAt ? formatDate(order.inTransitAt, locale) : undefined },
    { id: 'log-delivered', label: t('order.timeline.delivered'), state: 'upcoming', detail: order.logisticsDeliveredAt ? formatDate(order.logisticsDeliveredAt, locale) : undefined },
  ];

  const rank = { none: -1, dispatched: 0, in_transit: 1, delivered: 2 }[logistics] ?? -1;

  steps.forEach((step, index) => {
    if (rank > index) step.state = 'complete';
    else if (rank === index) step.state = 'current';
    else step.state = 'upcoming';
  });

  if (logistics === 'none' && ['pending', 'accepted'].includes(order.status)) {
    steps[0].state = 'upcoming';
    steps[0].detail = t('order.timeline.afterConfirmation');
  }

  return steps;
}

function StepDot({ state }: { state: StepState }) {
  const styles = {
    complete: 'border-leaf bg-leaf text-paper shadow-xs shadow-leaf/30',
    current: 'border-harvest bg-harvest/25 text-forest ring-4 ring-harvest/30 font-extrabold',
    upcoming: 'border-forest/20 bg-paper text-ink/30',
    cancelled: 'border-clay bg-clay/15 text-clay',
  }[state];

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all ${styles}`}
      aria-hidden="true"
    >
      {state === 'complete' ? '✓' : state === 'cancelled' ? '!' : ''}
    </span>
  );
}

function StepRow({ title, steps }: { title: string; steps: TimelineStep[] }) {
  return (
    <div className="space-y-2.5">
      <div className="inline-flex items-center gap-1.5 rounded-md bg-sand/35 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-soil">
        {title}
      </div>
      <ol className="flex flex-wrap items-start gap-y-3">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-[4.5rem] flex-col items-center gap-1 px-1 text-center sm:min-w-[5.5rem]">
              <StepDot state={step.state} />
              <span
                className={`text-xs font-semibold leading-tight ${
                  step.state === 'current'
                    ? 'font-bold text-forest'
                    : step.state === 'complete'
                      ? 'text-leaf'
                      : 'text-ink/45'
                }`}
              >
                {step.label}
              </span>
              {step.detail ? (
                <span className="text-[10px] font-medium text-ink/55">{step.detail}</span>
              ) : null}
            </div>
            {index < steps.length - 1 ? (
              <div
                className={`mx-1 h-0.5 min-w-[1rem] flex-1 rounded-full ${
                  step.state === 'complete' ? 'bg-leaf/60' : 'bg-forest/12'
                }`}
                aria-hidden="true"
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function OrderTimeline({ order }: { order: Order }) {
  const { locale, t } = useLocale();
  const lastIndex = MAIN_KEYS.length - 1;
  const mainSteps: TimelineStep[] = MAIN_KEYS.map((key, index) => ({
    id: `main-${index}`,
    label:
      order.status === 'cancelled' && index === lastIndex
        ? t('order.timeline.cancelled')
        : t(key),
    state:
      order.status === 'cancelled' && index === lastIndex
        ? 'cancelled'
        : mainStepState(index, order),
    detail:
      index === 0 && order.createdAt
        ? formatDate(order.createdAt, locale)
        : order.status === 'cancelled' && index === lastIndex && order.cancellationReason
          ? order.cancellationReason.slice(0, 40)
          : undefined,
  }));

  const payment = paymentSteps(order, t, locale);
  const logistics = logisticsSteps(order, t, locale);

  return (
    <div className="space-y-5 rounded-2xl border border-forest/10 bg-gradient-to-b from-forest/[0.02] to-paper p-5 shadow-xs sm:p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-forest sm:text-xl">
          {t('order.timeline.title')}
        </h2>
        <p className="text-xs text-ink/65 sm:text-sm">{t('order.timeline.subtitle')}</p>
      </div>
      <StepRow title={t('order.timeline.orderSection')} steps={mainSteps} />
      {payment ? <StepRow title={t('order.timeline.paymentSection')} steps={payment} /> : null}
      {logistics ? <StepRow title={t('order.timeline.deliverySection')} steps={logistics} /> : null}
    </div>
  );
}
