import { DEFAULT_LOCALE, type Locale } from './locales';
import { translate, type MessageKey } from './translate';

/**
 * Mirror of the locale held by `LocaleProvider`, for modules that cannot use hooks
 * (the API client, socket adapters, gateway wrappers). Components must keep using
 * `useLocale().t` so they re-render when the language changes.
 */
let activeLocale: Locale = DEFAULT_LOCALE;

export function setActiveLocale(next: Locale): void {
  activeLocale = next;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

/** `translate()` bound to the active locale. */
export function tt(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(activeLocale, key, vars);
}
