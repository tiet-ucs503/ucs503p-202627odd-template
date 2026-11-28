'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { getWeatherForecast, type WeatherSnapshot } from '@/lib/api/weather';
import { useLocale } from '@/features/i18n/locale-context';
import { useAuth } from '@/features/auth/auth-context';
import { cx } from '@/components/ui';
import type { Locale } from '@/lib/i18n/locales';

function WeatherGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6.5 14.5a3.5 3.5 0 1 1 1.2-6.8 4.25 4.25 0 0 1 8.1 1.4 2.75 2.75 0 0 1 .2 5.4H6.5Z" />
    </svg>
  );
}

function formatDayLabel(date: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

export function HeaderWeather() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const load = () => {
      void getWeatherForecast(locale)
        .then((result) => {
          if (cancelled) return;
          setWeather(result.data);
          setFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setWeather(null);
          setFailed(true);
        });
    };

    load();
    const timer = window.setInterval(load, 15 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user, locale]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const tempLabel =
    weather?.tempC !== null && weather?.tempC !== undefined
      ? `${Math.round(weather.tempC)}°`
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t('weather.aria')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={cx(
          'inline-flex max-w-[9.5rem] items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition sm:max-w-[14rem]',
          'text-paper/85 hover:bg-paper/10 hover:text-paper',
        )}
      >
        <WeatherGlyph />
        {weather && tempLabel ? (
          <>
            <span className="tabular-nums">{tempLabel}</span>
            <span className="hidden truncate capitalize sm:inline">
              {weather.description}
            </span>
          </>
        ) : failed ? (
          <span className="hidden text-paper/60 sm:inline">{t('weather.unavailable')}</span>
        ) : (
          <span className="text-paper/60">{t('common.loading')}</span>
        )}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('weather.aria')}
          className="absolute end-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-forest/15 bg-paper p-3 text-ink shadow-lg"
        >
          {weather ? (
            <div className="space-y-3 text-sm leading-relaxed">
              <div>
                <p className="font-display text-lg text-forest">
                  {tempLabel}
                  {weather.description ? (
                    <span className="ms-2 text-base font-sans font-semibold capitalize text-soil">
                      {weather.description}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs font-semibold text-forest">
                  {weather.profilePlace
                    ? t('weather.locationFromProfile', { place: weather.profilePlace })
                    : weather.place}
                </p>
              </div>
              <p>{weather.rainOutlook}</p>
              {weather.days.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-soil">
                    {t('weather.fiveDayTitle')}
                  </p>
                  <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10">
                    {weather.days.map((day) => (
                      <li
                        key={day.date}
                        className="flex items-start justify-between gap-2 px-2.5 py-2 text-xs"
                      >
                        <span className="min-w-0 font-semibold text-forest">
                          {formatDayLabel(day.date, locale)}
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">
                          {Math.round(day.tempMinC)}°/{Math.round(day.tempMaxC)}°
                        </span>
                        <span className="max-w-[7rem] truncate capitalize text-soil">
                          {day.description}
                        </span>
                        <span className="shrink-0 tabular-nums text-soil">
                          {day.rainMm > 0 ? `${day.rainMm}mm` : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-soil">{t('weather.regionalNote')}</p>
            </div>
          ) : (
            <p className="text-sm text-soil">{t('weather.unavailable')}</p>
          )}
          <button
            type="button"
            className="mt-3 text-xs font-bold text-forest hover:underline"
            onClick={() => setOpen(false)}
          >
            {t('weather.closeDetails')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
