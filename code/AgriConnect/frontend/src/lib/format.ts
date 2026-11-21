/**
 * `locale` is a UI locale code (`pa`, `hi`, …) so month names, grouping, and currency
 * placement follow the chosen language. Digits stay in the Latin numbering system on
 * purpose: mandi rates and money are compared against printed govt reports, which use
 * Latin digits even in regional-language editions.
 */
export function formatMoney(value: string | number, locale = 'en'): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return new Intl.NumberFormat(`${locale}-IN`, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(amount);
}

export function formatQty(value: string | number, unit: string, locale = 'en'): string {
  const amount = Number(value);
  const number = Number.isNaN(amount)
    ? String(value)
    : new Intl.NumberFormat(`${locale}-IN`, { numberingSystem: 'latn' }).format(amount);
  return `${number} ${unit}`;
}

export function formatDate(value: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(`${locale}-IN`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(new Date(value));
}

export function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}
