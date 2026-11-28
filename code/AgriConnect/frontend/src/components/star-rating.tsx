'use client';

import { cx } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';

export function formatRating(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num.toFixed(1);
}

export function StarDisplay({
  value,
  className,
}: {
  value: string | number | null | undefined;
  className?: string;
}) {
  const { t } = useLocale();
  const formatted = formatRating(value);
  if (!formatted) {
    return <span className={cx('text-sm text-ink/50', className)}>{t('rating.none')}</span>;
  }
  return (
    <span className={cx('inline-flex items-center gap-1 text-sm font-semibold text-harvest', className)}>
      <span aria-hidden>★</span>
      <span>{formatted}</span>
      <span className="text-ink/50 font-normal">{t('rating.outOfFive')}</span>
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();

  return (
    <div className="flex gap-1" role="group" aria-label={t('rating.groupLabel')}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cx(
            'text-2xl transition',
            star <= value ? 'text-harvest' : 'text-forest/20',
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-harvest',
          )}
          // "{count} out of 5" avoids English plural rules, which do not carry over.
          aria-label={t('rating.starLabel', { count: star })}
        >
          ★
        </button>
      ))}
    </div>
  );
}
