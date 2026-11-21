import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import {
  Fraunces,
  Noto_Nastaliq_Urdu,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Oriya,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Nunito,
} from 'next/font/google';
import { Providers } from '@/components/providers';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  localeDirection,
  normalizeLocale,
  translate,
} from '@/lib/i18n';
import './globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: '--font-noto-deva',
  subsets: ['devanagari'],
  weight: ['400', '600', '700'],
});

const notoGurmukhi = Noto_Sans_Gurmukhi({
  variable: '--font-noto-gur',
  subsets: ['gurmukhi'],
  weight: ['400', '600', '700'],
});

/**
 * One face per remaining script. Without these, ten of the thirteen locales depend on a
 * font the visitor happens to have installed ('Nirmala UI' is Windows-only), which is how
 * you end up with tofu boxes on a Mac or a phone. `preload: false` keeps them out of the
 * critical path: only the locale in `<html lang>` actually pulls its face down.
 * `next/font` reads these calls at build time, so every option has to be a literal.
 */
const notoBengali = Noto_Sans_Bengali({
  variable: '--font-noto-beng',
  subsets: ['bengali'],
  weight: ['400', '600', '700'],
  preload: false,
});

const notoTamil = Noto_Sans_Tamil({
  variable: '--font-noto-taml',
  subsets: ['tamil'],
  weight: ['400', '600', '700'],
  preload: false,
});

const notoTelugu = Noto_Sans_Telugu({
  variable: '--font-noto-telu',
  subsets: ['telugu'],
  weight: ['400', '600', '700'],
  preload: false,
});

const notoGujarati = Noto_Sans_Gujarati({
  variable: '--font-noto-gujr',
  subsets: ['gujarati'],
  weight: ['400', '600', '700'],
  preload: false,
});

const notoKannada = Noto_Sans_Kannada({
  variable: '--font-noto-knda',
  subsets: ['kannada'],
  weight: ['400', '600', '700'],
  preload: false,
});

const notoMalayalam = Noto_Sans_Malayalam({
  variable: '--font-noto-mlym',
  subsets: ['malayalam'],
  weight: ['400', '600', '700'],
  preload: false,
});

const notoOriya = Noto_Sans_Oriya({
  variable: '--font-noto-orya',
  subsets: ['oriya'],
  weight: ['400', '600', '700'],
  preload: false,
});

const notoUrdu = Noto_Nastaliq_Urdu({
  variable: '--font-noto-urdu',
  subsets: ['arabic'],
  weight: ['400', '600', '700'],
  preload: false,
});

const scriptFontVariables = [
  notoDevanagari.variable,
  notoGurmukhi.variable,
  notoBengali.variable,
  notoTamil.variable,
  notoTelugu.variable,
  notoGujarati.variable,
  notoKannada.variable,
  notoMalayalam.variable,
  notoOriya.variable,
  notoUrdu.variable,
].join(' ');

/** `LocaleProvider` writes this cookie, so the served HTML already matches the UI language. */
async function requestedLocale() {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_STORAGE_KEY)?.value) ?? DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestedLocale();
  return {
    title: translate(locale, 'meta.title'),
    description: translate(locale, 'meta.description'),
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await requestedLocale();

  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      suppressHydrationWarning
      className={`${nunito.variable} ${fraunces.variable} ${scriptFontVariables} h-full`}
    >
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
