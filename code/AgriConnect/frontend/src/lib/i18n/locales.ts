export const LOCALES = [
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

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'agriconnect.locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  pa: 'ਪੰਜਾਬੀ',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  mr: 'मराठी',
  gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
  or: 'ଓଡ଼ିଆ',
  as: 'অসমীয়া',
  ur: 'اردو',
};

/** BCP-47 tags for Web Speech API (STT / TTS). */
export const SPEECH_LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'or-IN',
  as: 'as-IN',
  ur: 'ur-IN',
};

const ALIASES: Record<string, Locale> = {
  en: 'en',
  english: 'en',
  hi: 'hi',
  hindi: 'hi',
  pa: 'pa',
  punjabi: 'pa',
  panjabi: 'pa',
  bn: 'bn',
  bengali: 'bn',
  bangla: 'bn',
  ta: 'ta',
  tamil: 'ta',
  te: 'te',
  telugu: 'te',
  mr: 'mr',
  marathi: 'mr',
  gu: 'gu',
  gujarati: 'gu',
  kn: 'kn',
  kannada: 'kn',
  ml: 'ml',
  malayalam: 'ml',
  or: 'or',
  odia: 'or',
  oriya: 'or',
  as: 'as',
  assamese: 'as',
  ur: 'ur',
  urdu: 'ur',
};

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase().replace('_', '-');
  const primary = raw.split('-')[0] ?? raw;
  if (raw.startsWith('pa-guru') || raw.startsWith('pa-in')) return 'pa';
  return ALIASES[raw] ?? ALIASES[primary] ?? null;
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Urdu is the only right-to-left locale; everything else reads left to right. */
const RTL_LOCALES = new Set<Locale>(['ur']);

export function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}
