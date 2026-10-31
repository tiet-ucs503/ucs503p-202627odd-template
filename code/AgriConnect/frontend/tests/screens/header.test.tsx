import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell';
import { translate } from '@/lib/i18n';
import { BUYER } from '../utils/auth-state';
import { renderWithLocale } from '../utils/render';

vi.mock('next/navigation', () => ({
  usePathname: () => '/buyer',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/api/notifications', () => ({
  listNotifications: vi.fn(() => Promise.resolve({ data: [], pagination: { total: 3 } })),
}));

vi.mock('@/lib/api/weather', () => ({
  getWeatherForecast: vi.fn(() =>
    Promise.resolve({
      data: {
        place: 'Ludhiana',
        profilePlace: 'Ludhiana, Punjab',
        description: 'clear sky',
        tempC: 31,
        humidity: 40,
        rainOutlook: 'No rain soon',
        alertLine: 'Live weather near Ludhiana',
        days: [
          {
            date: '2026-09-12',
            tempMinC: 24,
            tempMaxC: 33,
            description: 'few clouds',
            rainMm: 0,
          },
        ],
        source: 'OpenWeatherMap',
        fetchedAt: new Date().toISOString(),
      },
    }),
  ),
}));

vi.mock('@/lib/notifications-events', () => ({
  onNotificationsUpdated: vi.fn(() => () => undefined),
}));

/**
 * jsdom has no layout engine, so these assert the structure that makes overlap
 * impossible rather than measured pixels: the nav is allowed to shrink and scroll, and
 * the right-hand cluster is not. `tests/i18n-width-budget.test.ts` guards the copy that
 * would push the nav past that point.
 */
describe('header layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets the nav scroll instead of spilling over the right cluster', async () => {
    renderWithLocale(<AppShell>content</AppShell>, { locale: 'ta', user: BUYER });

    const [inlineNav] = await screen.findAllByRole('navigation', {
      name: translate('ta', 'nav.primaryNav'),
    });
    expect(inlineNav).toBeDefined();
    expect(inlineNav?.className).toContain('min-w-0');
    expect(inlineNav?.className).toContain('overflow-x-auto');
    // Inline from `lg` up; below that the second row carries the links.
    expect(inlineNav?.className).toContain('lg:flex');
  });

  it('shows the unread count on a bell labelled for screen readers', async () => {
    renderWithLocale(<AppShell>content</AppShell>, { locale: 'ta', user: BUYER });

    const bell = await screen.findByRole('link', {
      name: translate('ta', 'nav.notifications'),
    });
    expect(bell).toHaveTextContent('3');
    // The buyer's produce-alert link keeps its own word next to the bell. It appears
    // twice because the inline nav and the narrow-screen row both render the links.
    expect(screen.getAllByRole('link', { name: translate('ta', 'nav.alerts') })).toHaveLength(2);
  });

  it('keeps the language switcher a constant width across locales', () => {
    const { unmount } = renderWithLocale(<AppShell>content</AppShell>, { locale: 'ml' });
    expect(screen.getByText('ML')).toBeInTheDocument();
    unmount();

    renderWithLocale(<AppShell>content</AppShell>, { locale: 'en' });
    expect(screen.getByText('EN')).toBeInTheDocument();
  });
});
