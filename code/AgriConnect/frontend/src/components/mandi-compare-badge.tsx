'use client';

import { Badge } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import type { MandiCompareResult } from '@/lib/api/market';

export function MandiCompareBadge({
  compare,
  onImage = false,
}: {
  compare: MandiCompareResult;
  onImage?: boolean;
}) {
  const { t } = useLocale();

  if (compare.verdict === 'unknown') return null;

  if (compare.verdict === 'below_mandi') {
    const pct = compare.diffPercent ?? 0;
    return (
      <Badge tone="good" onImage={onImage}>
        {t('compare.below', { pct: pct !== 0 ? `${Math.abs(pct)}%` : '' }).trim()}
      </Badge>
    );
  }

  if (compare.verdict === 'above_mandi') {
    return (
      <Badge tone="warn" onImage={onImage}>
        {t('compare.above', { pct: compare.diffPercent ?? 0 })}
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" onImage={onImage}>
      {t('compare.matches')}
    </Badge>
  );
}
