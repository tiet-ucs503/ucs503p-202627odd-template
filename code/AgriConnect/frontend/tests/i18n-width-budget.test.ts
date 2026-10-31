import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/lib/i18n/locales';
import { messagesByLocale } from '@/lib/i18n/messages';
import { translate, type MessageKey } from '@/lib/i18n/translate';

/**
 * The header nav has a fixed amount of room, and `String.length` cannot measure it:
 * Indic combining marks inflate character counts, so by character count English and Urdu
 * look like the longest strings while Tamil actually renders widest. Estimate width as
 * graphemes times the average advance width of the script instead.
 */

/** Average advance width in em for the Noto face of each script, at one font size. */
const SCRIPT_WIDTH: Record<Locale, number> = {
  en: 0.52,
  hi: 0.62,
  mr: 0.62,
  pa: 0.58,
  gu: 0.58,
  bn: 0.62,
  as: 0.62,
  or: 0.7,
  te: 0.72,
  ta: 0.78,
  ml: 0.78,
  kn: 0.8,
  ur: 0.5,
};

const NAV_FONT_PX = 14;
/** `px-3` on both sides plus the `gap-0.5` between links. */
const NAV_CHROME_PX = 26;

/**
 * Space the inline nav gets at 1024px: 992px usable, less ~200px of logo, a 24px gap, and
 * ~316px for the compacted right cluster. The widest locale today is Tamil's buyer row at
 * ~479px, which the nav absorbs by scrolling; past this ceiling it would scroll on every
 * screen size, so a new label that big needs shorter copy or a different layout.
 */
const NAV_ROW_CEILING_PX = 520;

/** Single-line labels may grow well past English — short English words especially. */
const MAX_RATIO = 1.6;
const RATIO_FLOOR_EM = 8;

function graphemes(locale: Locale, value: string): number {
  return [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(value)].length;
}

function estimatedEm(locale: Locale, value: string): number {
  return graphemes(locale, value) * SCRIPT_WIDTH[locale];
}

function keysUnder(namespace: string): MessageKey[] {
  let cursor: unknown = messagesByLocale.en;
  for (const part of namespace.split('.')) cursor = (cursor as Record<string, unknown>)[part];
  return Object.entries(cursor as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'string')
    .map(([key]) => `${namespace}.${key}` as MessageKey);
}

/**
 * Copy that has to fit on one line. `compare.*` is deliberately absent: that badge sits
 * in a card and is free to wrap onto a second line.
 */
const SINGLE_LINE_KEYS: MessageKey[] = [
  ...keysUnder('nav'),
  ...keysUnder('order.status'),
  ...keysUnder('listing.status'),
  'kisan.tapToTalk',
  'kisan.stopMicLabel',
];

/** The nav rows `roleNav` renders, longest first. */
const NAV_ROWS: Record<string, readonly string[]> = {
  buyer: ['dashboard', 'browse', 'mandiPrices', 'alerts', 'myOrders'],
  farmer: ['dashboard', 'myListings', 'addProduce', 'orders'],
  admin: ['overview', 'users', 'listings', 'logs'],
  guest: ['browseProduce', 'mandiPrices'],
};

function navRowPx(locale: Locale, row: readonly string[]): number {
  return row.reduce(
    (total, key) =>
      total + estimatedEm(locale, translate(locale, `nav.${key}` as MessageKey)) * NAV_FONT_PX + NAV_CHROME_PX,
    0,
  );
}

const translatedLocales = LOCALES.filter((locale) => locale !== 'en');

describe('nav rows fit the header', () => {
  it.each(LOCALES)('%s keeps every role row under the ceiling', (locale) => {
    const tooWide = Object.entries(NAV_ROWS)
      .map(([role, row]) => [role, Math.round(navRowPx(locale, row))] as const)
      .filter(([, width]) => width > NAV_ROW_CEILING_PX)
      .map(([role, width]) => `${role}: ~${width}px > ${NAV_ROW_CEILING_PX}px`);
    expect(tooWide).toEqual([]);
  });
});

describe('single-line labels stay within budget', () => {
  it('budgets a meaningful number of keys', () => {
    expect(SINGLE_LINE_KEYS.length).toBeGreaterThan(20);
  });

  it.each(translatedLocales)('%s does not blow past the English width', (locale) => {
    const tooWide = SINGLE_LINE_KEYS.filter((key) => {
      const budget = Math.max(estimatedEm('en', translate('en', key)) * MAX_RATIO, RATIO_FLOOR_EM);
      return estimatedEm(locale, translate(locale, key)) > budget;
    }).map((key) => {
      const em = estimatedEm(locale, translate(locale, key)).toFixed(1);
      return `${key}: "${translate(locale, key)}" is ~${em}em`;
    });
    expect(tooWide).toEqual([]);
  });
});

describe('header labels stay distinguishable', () => {
  /** The bell and the buyer's produce-alert link sit side by side in the header. */
  it.each(LOCALES)('%s uses different words for alerts and notifications', (locale) => {
    expect(translate(locale, 'nav.notifications')).not.toBe(translate(locale, 'nav.alerts'));
  });
});
