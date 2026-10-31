'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui';
import { PublicListingsPreview } from '@/features/home/public-listings-preview';
import { useLocale } from '@/features/i18n/locale-context';
import { dashboardPath, useAuth } from '@/features/auth/auth-context';

const CATEGORIES = [
  { key: 'grains', labelKey: 'listing.category.grains', href: '/marketplace?category=grains' },
  { key: 'pulses', labelKey: 'listing.category.pulses', href: '/marketplace?category=pulses' },
  { key: 'vegetables', labelKey: 'listing.category.vegetables', href: '/marketplace?category=vegetables' },
  { key: 'fruits', labelKey: 'listing.category.fruits', href: '/marketplace?category=fruits' },
  { key: 'spices', labelKey: 'listing.category.spices', href: '/marketplace?category=spices' },
  { key: 'oilseeds', labelKey: 'listing.category.oilseeds', href: '/marketplace?category=oilseeds' },
] as const;

export default function HomePage() {
  const { t } = useLocale();
  const { user } = useAuth();

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest via-[#133d26] to-[#0a2416] px-6 py-14 text-paper shadow-[0_20px_50px_rgba(12,45,28,0.20)] border border-paper/10 md:px-14 md:py-20">
        <div
          className="pointer-events-none absolute -end-24 -top-24 h-96 w-96 rounded-full bg-harvest/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -start-24 -bottom-24 h-96 w-96 rounded-full bg-leaf/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <Logo variant="hero" linked={false} className="mb-6 drop-shadow-sm" />
          <div className="inline-flex items-center gap-2 rounded-full border border-harvest/35 bg-harvest/15 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-harvest backdrop-blur-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-harvest animate-pulse" aria-hidden="true" />
            <span>{t('home.eyebrow')}</span>
          </div>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.12] sm:text-5xl md:text-6xl text-paper tracking-tight drop-shadow-xs">
            {t('home.title')}
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg text-paper/85 leading-relaxed font-normal">
            {user
              ? user.role === 'FARMER'
                ? t('dashboard.farmerSubtitle')
                : user.role === 'BUYER'
                  ? t('dashboard.buyerSubtitle')
                  : t('meta.description')
              : t('home.subtitle')}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/marketplace">
              <Button
                variant="gold"
                className="text-base px-7 py-3.5 shadow-lg shadow-harvest/25 font-bold hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {t('home.browseListings')}
              </Button>
            </Link>
            {user ? (
              <Link href={dashboardPath(user.role)}>
                <Button
                  variant="outline-light"
                  className="text-base px-7 py-3.5 border-paper/30 hover:bg-paper/15 backdrop-blur-xs font-bold"
                >
                  {t('nav.dashboard')}
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button
                  variant="outline-light"
                  className="text-base px-7 py-3.5 border-paper/30 hover:bg-paper/15 backdrop-blur-xs font-bold"
                >
                  {t('home.createAccount')}
                </Button>
              </Link>
            )}
          </div>

          {/* Trust Highlights Strip */}
          <div className="mt-12 grid grid-cols-2 gap-3 pt-8 border-t border-paper/15 sm:grid-cols-4">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper/10 text-harvest"
                aria-hidden="true"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                  />
                </svg>
              </div>
              <span className="text-xs font-semibold text-paper/90 leading-tight">
                {t('listing.verifiedFarmer')}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper/10 text-leaf"
                aria-hidden="true"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <span className="text-xs font-semibold text-paper/90 leading-tight">
                {t('order.payment.escrowProtected')}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper/10 text-harvest"
                aria-hidden="true"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
              </div>
              <span className="text-xs font-semibold text-paper/90 leading-tight">
                {t('nav.mandiPrices')}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper/10 text-leaf"
                aria-hidden="true"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
              </div>
              <span className="text-xs font-semibold text-paper/90 leading-tight">
                {t('kisan.title')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Pills Slider */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-soil">
            {t('home.browseMarketplace')}
          </p>
          <Link
            href="/marketplace"
            className="text-xs font-bold text-leaf hover:underline"
          >
            {t('home.seeAll')}
          </Link>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={cat.href}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-forest/10 bg-paper px-4 py-2.5 text-sm font-semibold text-forest shadow-xs transition hover:border-leaf/40 hover:bg-leaf/5 hover:shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
              <span>{t(cat.labelKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Marketplace Banner */}
      <section>
        <Link
          href="/marketplace"
          className="group block overflow-hidden rounded-3xl border border-forest/10 bg-paper shadow-[0_4px_24px_rgba(12,45,28,0.06)] transition-all duration-300 hover:border-leaf/40 hover:shadow-[0_20px_40px_rgba(12,45,28,0.12)] hover:-translate-y-0.5"
        >
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-[240px] md:min-h-[300px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/crops/tomato.jpg"
                alt={t('home.marketplaceTitle')}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="photo-scrim pointer-events-none absolute inset-0 md:hidden" aria-hidden="true" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-forest group-hover:text-leaf transition-colors duration-200">
                {t('home.marketplaceTitle')}
              </h2>
              <p className="mt-3 text-base text-ink/75 leading-relaxed font-normal">
                {t('home.marketplaceBody')}
              </p>
              <p className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-leaf group-hover:underline">
                <span>{t('home.marketplaceCta')}</span>
                <span
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
              </p>
            </div>
          </div>
        </Link>
      </section>

      {/* Live Produce Section */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-forest tracking-tight">
              {t('home.onMarketTitle')}
            </h2>
            <p className="mt-1.5 max-w-2xl text-ink/75">
              {user ? t('marketplace.subtitle') : t('home.onMarketBody')}
            </p>
          </div>
          <Link href="/marketplace">
            <Button variant="secondary" className="text-sm font-bold">
              {t('home.seeAll')}
            </Button>
          </Link>
        </div>
        <PublicListingsPreview />
      </section>
    </div>
  );
}
