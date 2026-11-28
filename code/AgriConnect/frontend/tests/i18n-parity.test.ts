import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/lib/i18n/locales';
import { messagesByLocale } from '@/lib/i18n/messages';
import { collectMessageKeys } from '@/lib/i18n/translate';

type Dict = Record<string, unknown>;

function flatten(tree: Dict, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') Object.assign(out, flatten(value as Dict, path));
  }
  return out;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

/**
 * A value that contains no character from its own script is still English — that is how
 * this suite detects a key nobody translated, since `withEnglishFallback` silently fills
 * missing keys with the English string.
 */
const SCRIPT_RANGES: Record<Exclude<Locale, 'en'>, RegExp> = {
  hi: /[\u0900-\u097F]/,
  mr: /[\u0900-\u097F]/,
  pa: /[\u0A00-\u0A7F]/,
  bn: /[\u0980-\u09FF]/,
  as: /[\u0980-\u09FF]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  gu: /[\u0A80-\u0AFF]/,
  kn: /[\u0C80-\u0CFF]/,
  ml: /[\u0D00-\u0D7F]/,
  or: /[\u0B00-\u0B7F]/,
  ur: /[\u0600-\u06FF]/,
};

/** Keys that stay in Latin script on purpose, in every locale. */
const LATIN_BY_DESIGN = new Set([
  // A brand name.
  'order.payment.method.upi',
  // Placeholders and symbols only: "{qty} @ {price} / {unit}".
  'order.quantityLine',
]);

const enFlat = flatten(messagesByLocale.en as unknown as Dict);
const enKeys = collectMessageKeys(messagesByLocale.en as unknown as Dict);
const translatedLocales = LOCALES.filter((locale): locale is Exclude<Locale, 'en'> => locale !== 'en');

describe('English dictionary', () => {
  it('has no empty values', () => {
    const empty = Object.entries(enFlat)
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('exposes a non-trivial number of keys', () => {
    expect(enKeys.length).toBeGreaterThan(300);
  });
});

describe.each(translatedLocales)('%s dictionary', (locale) => {
  const flat = flatten(messagesByLocale[locale] as unknown as Dict);

  it('defines exactly the English key set', () => {
    expect(collectMessageKeys(messagesByLocale[locale] as unknown as Dict)).toEqual(enKeys);
  });

  it('has no empty values', () => {
    const empty = Object.entries(flat)
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('keeps the same {placeholder} variables as English', () => {
    const mismatched = Object.entries(flat)
      .filter(([key, value]) => placeholders(value).join(',') !== placeholders(enFlat[key]).join(','))
      .map(([key, value]) => `${key}: expected ${placeholders(enFlat[key]).join(', ')} — got ${placeholders(value).join(', ')}`);
    expect(mismatched).toEqual([]);
  });

  it('is written in its own script', () => {
    const script = SCRIPT_RANGES[locale];
    const untranslated = Object.entries(flat)
      .filter(([key]) => !LATIN_BY_DESIGN.has(key))
      .filter(([, value]) => !script.test(value))
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });
});
