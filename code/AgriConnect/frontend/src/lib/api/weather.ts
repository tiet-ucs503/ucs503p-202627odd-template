import { apiRequest } from './client';
import type { Locale } from '@/lib/i18n/locales';

export interface WeatherDay {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  description: string;
  rainMm: number;
}

export interface WeatherSnapshot {
  place: string;
  profilePlace: string | null;
  description: string;
  tempC: number | null;
  humidity: number | null;
  rainOutlook: string;
  alertLine: string;
  days: WeatherDay[];
  source: string;
  fetchedAt: string;
}

export function getWeatherForecast(language?: Locale) {
  return apiRequest<WeatherSnapshot>('/api/v1/weather', {
    query: language ? { language } : undefined,
  });
}
