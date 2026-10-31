/** Supported UI / Kisan reply languages (major Indian state / scheduled languages). */
export const APP_LOCALES = [
  'en',
  'hi',
  'pa',
  'bn',
  'ta',
  'te',
  'mr',
  'gu',
  'kn',
  'ml',
  'or',
  'as',
  'ur',
] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const appLocaleSchema = APP_LOCALES;
