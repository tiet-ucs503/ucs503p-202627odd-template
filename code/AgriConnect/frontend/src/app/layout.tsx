import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { Fraunces, Nunito } from 'next/font/google';
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
      className={`${nunito.variable} ${fraunces.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
