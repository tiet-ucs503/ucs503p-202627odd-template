import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LocaleProvider } from '@/features/i18n/locale-context';
import { LOCALE_STORAGE_KEY, type Locale, translate, type MessageKey } from '@/lib/i18n';
import type { AuthUser } from '@/lib/api/types';
import { setAuthUser } from './auth-state';

/** Renders a screen with the language pinned, the way a Punjabi user would see it. */
export function renderWithLocale(
  ui: ReactElement,
  { locale = 'pa' as Locale, user = null as AuthUser | null } = {},
): RenderResult {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  setAuthUser(user ? { ...user, languagePref: locale } : null);
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

/** The expected copy for a key, so assertions never hardcode a translation. */
export function pa(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate('pa', key, vars);
}
