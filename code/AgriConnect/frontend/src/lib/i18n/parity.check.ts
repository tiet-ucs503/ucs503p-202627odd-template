import assert from 'node:assert/strict';
import { collectMessageKeys, translate } from './translate';
import { messagesByLocale } from './messages';
import { LOCALES, normalizeLocale } from './locales';

const enKeys = collectMessageKeys(messagesByLocale.en as unknown as Record<string, unknown>);

for (const locale of LOCALES) {
  if (locale === 'en') continue;
  const keys = collectMessageKeys(messagesByLocale[locale] as unknown as Record<string, unknown>);
  assert.deepEqual(keys, enKeys, `${locale} messages must define the same keys as English`);
}

assert.equal(translate('en', 'nav.mandiPrices'), 'Mandi prices');
assert.equal(translate('hi', 'nav.mandiPrices'), 'मंडी भाव');
assert.equal(normalizeLocale('ta-IN'), 'ta');
assert.equal(normalizeLocale('bn'), 'bn');
assert.equal(normalizeLocale('fr'), null);

console.log(`i18n parity OK (${String(enKeys.length)} keys × ${String(LOCALES.length)} locales)`);
