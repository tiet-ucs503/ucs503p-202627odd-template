import type { MessageKey } from '@/lib/i18n';
import type { NotificationItem } from '@/lib/api/types';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/**
 * Notification `title` / `body` are written in English at creation time and stored in
 * Postgres, so they cannot be translated after the fact. Rows created from the
 * `notification_params` migration onwards also carry `params` — the values behind the
 * sentence — which lets us rebuild the copy in the reader's language here. Rows without
 * `params` (or of an unknown shape) keep showing the stored English strings.
 */

/** `type` plus `params.variant`: one enum value can describe more than one sentence. */
type CopyKind =
  | 'ORDER_PLACED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_LOGISTICS'
  | 'ORDER_PAYMENT_DUE'
  | 'MESSAGE_RECEIVED'
  | 'LISTING_EXPIRING'
  | 'LISTING_PUBLISHED'
  | 'ACCOUNT_SUSPENDED'
  | 'LISTING_REMOVED'
  | 'LISTING_REINSTATED';

const ORDER_STATUS_KEYS: Record<string, MessageKey> = {
  pending: 'order.status.pending',
  accepted: 'order.status.accepted',
  confirmed: 'order.status.confirmed',
  fulfilled: 'order.status.fulfilled',
  cancelled: 'order.status.cancelled',
};

const LOGISTICS_KEYS: Record<string, MessageKey> = {
  dispatched: 'order.timeline.dispatched',
  in_transit: 'order.timeline.inTransit',
  delivered: 'order.timeline.delivered',
};

function copyKind(item: NotificationItem): CopyKind | null {
  const variant = item.params?.variant;
  if (item.type === 'ORDER_STATUS_CHANGED') {
    if (variant === 'logistics') return 'ORDER_LOGISTICS';
    if (variant === 'payment') return 'ORDER_PAYMENT_DUE';
    return 'ORDER_STATUS_CHANGED';
  }
  if (item.type === 'LISTING_MODERATED') {
    return variant === 'reinstated' ? 'LISTING_REINSTATED' : 'LISTING_REMOVED';
  }
  const known: readonly CopyKind[] = [
    'ORDER_PLACED',
    'MESSAGE_RECEIVED',
    'LISTING_EXPIRING',
    'LISTING_PUBLISHED',
    'ACCOUNT_SUSPENDED',
  ];
  return known.find((kind) => kind === item.type) ?? null;
}

/** Translate the enum values inside `params` so the sentence reads in one language. */
function localizedVars(
  kind: CopyKind,
  params: Record<string, string | number>,
  t: Translate,
): Record<string, string | number> {
  if (kind === 'ORDER_STATUS_CHANGED') {
    const from = ORDER_STATUS_KEYS[String(params.from)];
    const to = ORDER_STATUS_KEYS[String(params.to)];
    return {
      from: from ? t(from) : String(params.from ?? ''),
      to: to ? t(to) : String(params.to ?? ''),
    };
  }
  if (kind === 'ORDER_LOGISTICS') {
    const status = LOGISTICS_KEYS[String(params.status)];
    return { status: status ? t(status) : String(params.status ?? '') };
  }
  return params;
}

export interface NotificationCopy {
  title: string;
  body: string;
}

export function notificationCopy(item: NotificationItem, t: Translate): NotificationCopy {
  const params = item.params;
  const kind = params ? copyKind(item) : null;
  if (!kind || !params) return { title: item.title, body: item.body };

  const vars = localizedVars(kind, params, t);
  const title = t(`alerts.heading.${kind}` as MessageKey, vars);

  // A chat preview and an admin's suspension reason are human text, not template copy.
  if (kind === 'MESSAGE_RECEIVED') {
    return { title, body: String(params.preview ?? item.body) };
  }
  if (typeof params.reason === 'string' && params.reason.trim() !== '') {
    return { title, body: t('alerts.body.reason', { reason: params.reason }) };
  }

  return { title, body: t(`alerts.body.${kind}` as MessageKey, vars) };
}
