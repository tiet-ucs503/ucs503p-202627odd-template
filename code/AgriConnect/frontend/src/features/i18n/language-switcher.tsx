'use client';

import { LOCALES, LOCALE_LABELS } from '@/lib/i18n';
import { useLocale } from '@/features/i18n/locale-context';

/**
 * A native `<select>` is as wide as its widest option, so thirteen native language names
 * used to cost the header ~110px in every locale. The select is kept (real keyboard and
 * mobile behaviour, full names in the dropdown) but rendered transparent over a
 * fixed-width chip showing the current locale code.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as (typeof LOCALES)[number])}
        aria-label={t('common.language')}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent text-transparent opacity-0 outline-none"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} className="bg-forest text-paper">
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none inline-flex items-center gap-1 rounded-lg border border-paper/20 px-2 py-1.5 text-xs font-bold text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-harvest"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="10" cy="10" r="7.25" />
          <path d="M2.75 10h14.5M10 2.75c1.9 2 2.9 4.5 2.9 7.25s-1 5.25-2.9 7.25c-1.9-2-2.9-4.5-2.9-7.25S8.1 4.75 10 2.75Z" />
        </svg>
        {locale.toUpperCase()}
      </span>
    </label>
  );
}
