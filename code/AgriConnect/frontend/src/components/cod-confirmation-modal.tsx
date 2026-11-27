'use client';

import { Badge, Button, Card } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { formatDate, formatMoney } from '@/lib/format';
import type { Order } from '@/lib/api/types';

export function CodConfirmationModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
}) {
  const { locale, t } = useLocale();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/60 backdrop-blur-sm">
      <Card className="w-full max-w-lg space-y-5 border-leaf/30 shadow-2xl bg-paper p-6 sm:p-8">
        <div className="text-center space-y-2">
          <span className="inline-block text-4xl" aria-hidden="true">
            🎉
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-forest">
            {t('order.timeline.confirmed')}
          </h2>
          <Badge tone="good">
            {t('order.payment.method.cod')} · {t('order.payment.payOnDelivery')}
          </Badge>
        </div>

        <div className="rounded-xl border border-forest/10 bg-forest/[0.03] p-4 space-y-2.5 text-sm text-ink/80">
          <div className="flex justify-between items-center pb-2 border-b border-forest/10">
            <span className="font-semibold text-forest">
              {t('order.titleFallback')} #{order.id.slice(0, 8)}
            </span>
            <span className="font-bold text-forest text-base">
              {formatMoney(order.priceTotal, locale)}
            </span>
          </div>
          <p>{t('order.deliveryLine', { mode: t(`order.deliveryMode.${order.deliveryMode}`) })}</p>
          <p>{t('order.placedLine', { date: formatDate(order.createdAt, locale) })}</p>
          <p className="font-medium text-forest/90 pt-1">
            {t('order.payment.codNote')}
          </p>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="w-full justify-center shadow-md py-3 text-base"
          >
            {t('order.actions.confirm')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
