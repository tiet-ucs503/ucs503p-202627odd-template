'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { listNotifications } from '@/lib/api/notifications';
import { onNotificationsUpdated } from '@/lib/notifications-events';
import { dashboardPath, useAuth } from '@/features/auth/auth-context';
import { useLocale } from '@/features/i18n/locale-context';
import { LanguageSwitcher } from '@/features/i18n/language-switcher';
import { FarmerChatWidget } from '@/features/assistant/FarmerChatWidget';
import { HeaderWeather } from '@/features/weather/HeaderWeather';
import { Logo } from '@/components/logo';
import { cx } from '@/components/ui';
import type { MessageKey } from '@/lib/i18n';

const SCROLLBAR_HIDDEN =
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** Dashboard roots match exactly; other nav items match their subtree (not sibling routes). */
function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;

  const dashboardRoots = ['/farmer', '/buyer', '/admin'];
  if (dashboardRoots.includes(href)) return false;

  if (!pathname.startsWith(`${href}/`)) return false;

  if (href === '/farmer/listings' && pathname.startsWith('/farmer/listings/new')) {
    return false;
  }

  return true;
}

function NavLink({
  href,
  className,
  label,
  children,
}: {
  href: string;
  className?: string;
  /** Accessible name when `children` is an icon rather than text. */
  label?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = isNavActive(pathname, href);
  return (
    <Link
      href={href}
      aria-label={label}
      className={cx(
        'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
        active
          ? 'bg-harvest text-forest shadow-xs'
          : 'text-paper/85 hover:bg-paper/12 hover:text-paper',
        className,
      )}
    >
      {children}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M10 2.75a4.6 4.6 0 0 0-4.6 4.6v2.4L4.1 12.4h11.8L14.6 9.75v-2.4A4.6 4.6 0 0 0 10 2.75Z" />
      <path d="M8.1 15.1a1.95 1.95 0 0 0 3.8 0" />
    </svg>
  );
}

function roleNav(
  role: string | undefined,
  t: (key: MessageKey) => string,
): ReactNode {
  if (role === 'FARMER') {
    return (
      <>
        <NavLink href="/farmer">{t('nav.dashboard')}</NavLink>
        <NavLink href="/farmer/listings">{t('nav.myListings')}</NavLink>
        <NavLink href="/farmer/listings/new">{t('nav.addProduce')}</NavLink>
        <NavLink href="/orders">{t('nav.orders')}</NavLink>
      </>
    );
  }
  if (role === 'BUYER') {
    return (
      <>
        <NavLink href="/buyer">{t('nav.dashboard')}</NavLink>
        <NavLink href="/marketplace">{t('nav.browse')}</NavLink>
        <NavLink href="/market-prices">{t('nav.mandiPrices')}</NavLink>
        <NavLink href="/buyer/alerts">{t('nav.alerts')}</NavLink>
        <NavLink href="/orders">{t('nav.myOrders')}</NavLink>
      </>
    );
  }
  if (role === 'ADMIN') {
    return (
      <>
        <NavLink href="/admin">{t('nav.overview')}</NavLink>
        <NavLink href="/admin/users">{t('nav.users')}</NavLink>
        <NavLink href="/admin/listings">{t('nav.listings')}</NavLink>
        <NavLink href="/admin/logs">{t('nav.logs')}</NavLink>
      </>
    );
  }
  if (role === 'AGRONOMIST') {
    return (
      <>
        <NavLink href="/notifications">{t('nav.notifications')}</NavLink>
        <NavLink href="/marketplace">{t('nav.browse')}</NavLink>
      </>
    );
  }
  return (
    <>
      <NavLink href="/marketplace">{t('nav.browseProduce')}</NavLink>
      <NavLink href="/market-prices">{t('nav.mandiPrices')}</NavLink>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const { t } = useLocale();
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;
    const load = () => {
      void listNotifications({ unread: true, limit: 1 })
        .then((result) => setUnread(result.pagination?.total ?? result.data.length))
        .catch(() => undefined);
    };
    load();
    const unsubscribe = onNotificationsUpdated(load);
    const timer = window.setInterval(load, 60_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [user, pathname]);

  const links = roleNav(user?.role, t);

  return (
    <div className="min-h-full bg-field">
      <header className="sticky top-0 z-30 border-b border-harvest/25 bg-forest/96 backdrop-blur-md text-paper shadow-[0_8px_28px_rgba(12,45,28,0.22)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6">
            <Logo variant="header" />
            {/* Scrolls instead of spilling over the right cluster when a locale's labels
                are wider than English — Tamil, Kannada, and Malayalam are ~20% wider. */}
            <nav
              className={cx(
                'hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex',
                SCROLLBAR_HIDDEN,
              )}
              aria-label={t('nav.primaryNav')}
            >
              {links}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <HeaderWeather />
            <LanguageSwitcher />
            {!user ? (
              <>
                <NavLink href="/login">{t('nav.logIn')}</NavLink>
                <Link
                  href="/register"
                  className="rounded-xl bg-harvest px-4 py-2 text-sm font-bold text-forest shadow-xs hover:bg-[#c49212] transition-colors"
                >
                  {t('nav.join')}
                </Link>
              </>
            ) : (
              <>
                {user.isSuspended ? (
                  <span className="rounded-full bg-clay px-3 py-1 text-xs font-bold">
                    {t('nav.suspended')}
                  </span>
                ) : null}
                <NavLink
                  href="/notifications"
                  label={t('nav.notifications')}
                  className="relative p-2"
                >
                  <BellIcon />
                  {unread ? (
                    <span className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-harvest px-1 py-0.5 text-[10px] font-bold leading-none text-forest shadow-xs">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </NavLink>
                <NavLink href="/profile" className="max-w-[8rem] truncate flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper/20 text-[11px] font-bold" aria-hidden>
                    {user.name.trim()[0]?.toUpperCase()}
                  </span>
                  <span className="truncate">{user.name.split(' ')[0]}</span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-paper/80 hover:bg-paper/10 hover:text-paper transition-colors cursor-pointer"
                >
                  {t('nav.logOut')}
                </button>
              </>
            )}
          </div>
        </div>
        <nav
          className={cx(
            'flex gap-1 overflow-x-auto border-t border-harvest/20 bg-forest px-4 py-2 lg:hidden',
            SCROLLBAR_HIDDEN,
          )}
          aria-label={t('nav.primaryNav')}
        >
          {links}
        </nav>
      </header>
      <main
        className={cx('mx-auto w-full max-w-6xl px-4 py-8', user ? 'pb-28' : '')}
      >
        {children}
      </main>
      {ready && user ? (
        <>
          <p className="sr-only">
            {t('shell.signedIn', { email: user.email, path: dashboardPath(user.role) })}
          </p>
          <FarmerChatWidget role={user.role} name={user.name} />
        </>
      ) : null}
    </div>
  );
}
