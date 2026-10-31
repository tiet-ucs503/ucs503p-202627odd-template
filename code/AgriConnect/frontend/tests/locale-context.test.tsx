import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider, useLocale } from '@/features/i18n/locale-context';
import { LOCALE_STORAGE_KEY, translate } from '@/lib/i18n';
import { updateMe } from '@/lib/api/users';
import { en } from '@/lib/i18n/messages/en';
import { withEnglishFallback } from '@/lib/i18n/messages/merge';
import { FARMER, setAuthUser } from './utils/auth-state';

vi.mock('@/lib/api/users', () => ({
  updateMe: vi.fn(() => Promise.resolve({ data: {} })),
}));

function Probe() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="copy">{t('nav.mandiPrices')}</p>
      <button type="button" onClick={() => setLocale('pa')}>
        switch
      </button>
    </div>
  );
}

describe('LocaleProvider', () => {
  it('re-renders copy, persists the choice, and syncs languagePref', async () => {
    setAuthUser({ ...FARMER, languagePref: 'en' });
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('copy')).toHaveTextContent('Mandi prices');

    await userEvent.click(screen.getByRole('button', { name: 'switch' }));

    expect(screen.getByTestId('locale')).toHaveTextContent('pa');
    expect(screen.getByTestId('copy')).toHaveTextContent(translate('pa', 'nav.mandiPrices'));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pa');
    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({ languagePref: 'pa' });
    });
  });

  it('writes the locale cookie the root layout reads', async () => {
    setAuthUser(null);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'hi');
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(document.cookie).toContain(`${LOCALE_STORAGE_KEY}=hi`);
    });
    expect(document.documentElement.lang).toBe('hi');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('lays Urdu out right-to-left and switches back for English', async () => {
    setAuthUser(null);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ur');
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
    });
    expect(document.documentElement.lang).toBe('ur');

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    act(() => {
      window.dispatchEvent(new Event('agriconnect-locale'));
    });

    await waitFor(() => {
      expect(document.documentElement.dir).toBe('ltr');
    });
  });

  it('fills untranslated keys from English for a partial dictionary', () => {
    const partial = withEnglishFallback({ common: { save: 'ਸੰਭਾਲੋ' } });

    expect(partial.common.save).toBe('ਸੰਭਾਲੋ');
    expect(partial.common.loading).toBe(en.common.loading);
    expect(partial.order.payment.title).toBe(en.order.payment.title);
  });
});
