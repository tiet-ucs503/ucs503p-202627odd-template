import { getEnv } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

const FALLBACK_LAT = 28.6139;
const FALLBACK_LON = 77.209;
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface WeatherLocationQuery {
  state?: string | null;
  district?: string | null;
  village?: string | null;
}

export interface DayForecast {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  description: string;
  rainMm: number;
}

export interface LiveWeather {
  place: string;
  profilePlace: string | null;
  description: string;
  tempC: number | null;
  humidity: number | null;
  rainOutlook: string;
  alertLine: string;
  evidence: string;
  days: DayForecast[];
  citation: { id: string; title: string; source: string };
  fetchedAt: string;
}

interface ForecastSlot {
  dt: number;
  main?: { temp?: number; temp_min?: number; temp_max?: number };
  weather?: { description?: string }[];
  rain?: { '3h'?: number };
}

const weatherCache = new Map<string, { expires: number; value: LiveWeather }>();
const geoCache = new Map<string, { expires: number; lat: number; lon: number; label: string }>();

function farmerAlert(
  place: string,
  desc: string,
  tempPart: string,
  humidityPart: string,
  rainOutlook: string,
  language: string,
): string {
  const lines: Record<string, string> = {
    en: `Live weather near ${place}: ${desc}, ${tempPart}, humidity ${humidityPart}. ${rainOutlook}`,
    hi: `लाइव मौसम (${place} के पास): ${desc}, ${tempPart}, नमी ${humidityPart}। ${rainOutlook}`,
    pa: `ਲਾਈਵ ਮੌਸਮ (${place} ਨੇੜੇ): ${desc}, ${tempPart}, ਨਮੀ ${humidityPart}। ${rainOutlook}`,
  };
  const english = lines.en;
  if (!english) return Object.values(lines)[0] ?? '';
  return lines[language] ?? english;
}

function rainOutlookFromForecast(list: ForecastSlot[], language: string): string {
  const now = Date.now() / 1000;
  const horizon = now + 48 * 3600;
  const upcoming = list.filter((row) => row.dt >= now && row.dt <= horizon);
  const rainMm = upcoming.reduce((sum, row) => sum + (row.rain?.['3h'] ?? 0), 0);
  const rainySlots = upcoming.filter((row) => (row.rain?.['3h'] ?? 0) > 0.2).length;

  if (rainMm >= 5 || rainySlots >= 2) {
    const en = `Rain likely in the next 24–48 hours (~${rainMm.toFixed(1)} mm). Prefer delaying irrigation.`;
    const hi = `अगले 24–48 घंटों में बारिश संभव (~${rainMm.toFixed(1)} मिमी)। सिंचाई टालना बेहतर।`;
    const pa = `ਅਗਲੇ 24–48 ਘੰਟਿਆਂ ਵਿੱਚ ਮੀਂਹ ਸੰਭਵ (~${rainMm.toFixed(1)} ਮਿਮੀ)। ਸਿੰਚਾਈ ਰੋਕਣਾ ਬਿਹਤਰ।`;
    if (language === 'hi') return hi;
    if (language === 'pa') return pa;
    return en;
  }
  if (rainMm > 0 || rainySlots === 1) {
    const en = `Light rain possible in the next 24–48 hours (~${rainMm.toFixed(1)} mm). Watch the sky before irrigating.`;
    const hi = `अगले 24–48 घंटों में हल्की बारिश संभव (~${rainMm.toFixed(1)} मिमी)। सिंचाई से पहले आसमान देखें।`;
    const pa = `ਅਗਲੇ 24–48 ਘੰਟਿਆਂ ਵਿੱਚ ਹਲਕਾ ਮੀਂਹ ਸੰਭਵ (~${rainMm.toFixed(1)} ਮਿਮੀ)। ਸਿੰਚਾਈ ਤੋਂ ਪਹਿਲਾਂ ਅਸਮਾਨ ਵੇਖੋ।`;
    if (language === 'hi') return hi;
    if (language === 'pa') return pa;
    return en;
  }
  const en = 'No meaningful rain in the next 24–48 hours — irrigate by crop stage if soil is dry.';
  const hi = 'अगले 24–48 घंटों में खास बारिश नहीं — मिट्टी सूखी हो तो फसल अवस्था के अनुसार सिंचाई करें।';
  const pa = 'ਅਗਲੇ 24–48 ਘੰਟਿਆਂ ਵਿੱਚ ਖਾਸ ਮੀਂਹ ਨਹੀਂ — ਮਿੱਟੀ ਸੁੱਕੀ ਹੋਵੇ ਤਾਂ ਫਸਲ ਅਵਸਥਾ ਅਨੁਸਾਰ ਸਿੰਚਾਈ ਕਰੋ।';
  if (language === 'hi') return hi;
  if (language === 'pa') return pa;
  return en;
}

function buildFiveDay(list: ForecastSlot[]): DayForecast[] {
  const byDay = new Map<
    string,
    { mins: number[]; maxes: number[]; rains: number[]; descriptions: string[] }
  >();

  for (const slot of list) {
    const date = new Date(slot.dt * 1000).toISOString().slice(0, 10);
    const bucket = byDay.get(date) ?? { mins: [], maxes: [], rains: [], descriptions: [] };
    const temp = slot.main?.temp;
    const tMin = slot.main?.temp_min ?? temp;
    const tMax = slot.main?.temp_max ?? temp;
    if (typeof tMin === 'number') bucket.mins.push(tMin);
    if (typeof tMax === 'number') bucket.maxes.push(tMax);
    bucket.rains.push(slot.rain?.['3h'] ?? 0);
    const desc = slot.weather?.[0]?.description;
    if (desc) bucket.descriptions.push(desc);
    byDay.set(date, bucket);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5)
    .map(([date, bucket]) => {
      const description =
        bucket.descriptions.sort(
          (a, b) =>
            bucket.descriptions.filter((d) => d === b).length -
            bucket.descriptions.filter((d) => d === a).length,
        )[0] ?? '—';
      return {
        date,
        tempMinC: Number(Math.min(...bucket.mins).toFixed(1)),
        tempMaxC: Number(Math.max(...bucket.maxes).toFixed(1)),
        description,
        rainMm: Number(bucket.rains.reduce((sum, mm) => sum + mm, 0).toFixed(1)),
      };
    });
}

function profileLabel(location?: WeatherLocationQuery): string | null {
  if (!location) return null;
  const parts = [location.village, location.district, location.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : null;
}

async function geocodeLocation(
  location: WeatherLocationQuery | undefined,
  apiKey: string,
): Promise<{ lat: number; lon: number; label: string; fromProfile: boolean }> {
  const attempts: string[] = [];
  const village = location?.village?.trim();
  const district = location?.district?.trim();
  const state = location?.state?.trim();

  if (village && district && state) attempts.push(`${village},${district},${state},IN`);
  if (district && state) attempts.push(`${district},${state},IN`);
  if (state) attempts.push(`${state},IN`);
  if (district) attempts.push(`${district},IN`);

  for (const q of attempts) {
    const cached = geoCache.get(q);
    if (cached && cached.expires > Date.now()) {
      return { lat: cached.lat, lon: cached.lon, label: cached.label, fromProfile: true };
    }

    const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '1');
    url.searchParams.set('appid', apiKey);

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) continue;
      const rows = (await response.json()) as {
        name?: string;
        state?: string;
        country?: string;
        lat?: number;
        lon?: number;
      }[];
      const hit = rows[0];
      if (!hit || typeof hit.lat !== 'number' || typeof hit.lon !== 'number') continue;
      const label = [hit.name, hit.state].filter(Boolean).join(', ') || q;
      geoCache.set(q, { expires: Date.now() + CACHE_TTL_MS * 6, lat: hit.lat, lon: hit.lon, label });
      return { lat: hit.lat, lon: hit.lon, label, fromProfile: true };
    } catch (error) {
      logger.warn({ err: error, q }, 'OpenWeather geocode failed');
    }
  }

  return {
    lat: FALLBACK_LAT,
    lon: FALLBACK_LON,
    label: 'New Delhi',
    fromProfile: false,
  };
}

/**
 * Live weather + 5-day outlook for the farmer's profile location (district/state),
 * falling back to Delhi only when profile location cannot be geocoded.
 */
export async function fetchLiveWeather(
  language = 'en',
  location?: WeatherLocationQuery,
): Promise<LiveWeather | null> {
  const key = getEnv().OPENWEATHER_API_KEY;
  if (!key) return null;

  const profilePlace = profileLabel(location);
  const coords = await geocodeLocation(location, key);
  const cacheKey = `${language}|${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
  const hit = weatherCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;

  const currentUrl = new URL('https://api.openweathermap.org/data/2.5/weather');
  currentUrl.searchParams.set('lat', String(coords.lat));
  currentUrl.searchParams.set('lon', String(coords.lon));
  currentUrl.searchParams.set('appid', key);
  currentUrl.searchParams.set('units', 'metric');

  const forecastUrl = new URL('https://api.openweathermap.org/data/2.5/forecast');
  forecastUrl.searchParams.set('lat', String(coords.lat));
  forecastUrl.searchParams.set('lon', String(coords.lon));
  forecastUrl.searchParams.set('appid', key);
  forecastUrl.searchParams.set('units', 'metric');

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl, { signal: AbortSignal.timeout(8_000) }),
      fetch(forecastUrl, { signal: AbortSignal.timeout(8_000) }),
    ]);

    if (!currentRes.ok) {
      logger.warn({ status: currentRes.status }, 'OpenWeatherMap current weather failed');
      return null;
    }

    const current = (await currentRes.json()) as {
      weather?: { description?: string }[];
      main?: { temp?: number; humidity?: number };
      name?: string;
      rain?: { '1h'?: number; '3h'?: number };
    };

    let rainOutlook =
      language === 'hi'
        ? 'अगले 24–48 घंटों का पूर्वानुमान अभी उपलब्ध नहीं।'
        : language === 'pa'
          ? 'ਅਗਲੇ 24–48 ਘੰਟਿਆਂ ਦੀ ਭਵਿੱਖਬਾਣੀ ਹਾਲੇ ਉਪਲਬਧ ਨਹੀਂ।'
          : 'Next 24–48 hour forecast unavailable right now.';
    let days: DayForecast[] = [];

    if (forecastRes.ok) {
      const forecast = (await forecastRes.json()) as { list?: ForecastSlot[] };
      if (forecast.list?.length) {
        rainOutlook = rainOutlookFromForecast(forecast.list, language);
        days = buildFiveDay(forecast.list);
      }
    } else {
      logger.warn({ status: forecastRes.status }, 'OpenWeatherMap forecast failed');
    }

    const desc = current.weather?.[0]?.description ?? 'conditions unavailable';
    const temp = current.main?.temp;
    const humidity = current.main?.humidity;
    const place = coords.fromProfile
      ? profilePlace ?? coords.label
      : current.name ?? coords.label;
    const tempPart = typeof temp === 'number' ? `${temp.toFixed(1)}°C` : 'n/a';
    const humidityPart = typeof humidity === 'number' ? `${String(humidity)}%` : 'n/a';
    const recentRain = current.rain?.['1h'] ?? current.rain?.['3h'];
    const recentRainNote =
      typeof recentRain === 'number' && recentRain > 0
        ? ` Recent rain: ${recentRain.toFixed(1)} mm.`
        : '';

    const alertLine = farmerAlert(
      place,
      desc,
      tempPart,
      humidityPart,
      `${rainOutlook}${recentRainNote}`,
      language,
    );

    const dayEvidence = days
      .map(
        (day) =>
          `${day.date}: ${day.description}, ${String(day.tempMinC)}–${String(day.tempMaxC)}°C, rain ${String(day.rainMm)} mm`,
      )
      .join('; ');

    const evidence = [
      `OpenWeatherMap for ${place}: ${desc}, temperature ${tempPart}, humidity ${humidityPart}.${recentRainNote}`,
      rainOutlook,
      dayEvidence ? `Five-day outlook: ${dayEvidence}.` : '',
      'Confirm with local IMD if field conditions differ.',
    ]
      .filter(Boolean)
      .join(' ');

    const value: LiveWeather = {
      place,
      profilePlace,
      description: desc,
      tempC: typeof temp === 'number' ? Number(temp.toFixed(1)) : null,
      humidity: typeof humidity === 'number' ? humidity : null,
      rainOutlook: `${rainOutlook}${recentRainNote}`,
      alertLine,
      evidence,
      days,
      citation: {
        id: 'live-openweather',
        title: 'Live weather + 5-day forecast',
        source: 'OpenWeatherMap (profile location)',
      },
      fetchedAt: new Date().toISOString(),
    };

    weatherCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    logger.warn({ err: error }, 'OpenWeatherMap fetch error');
    return null;
  }
}

export async function fetchOpenWeatherSnippet(
  language = 'en',
  location?: WeatherLocationQuery,
): Promise<string | null> {
  const live = await fetchLiveWeather(language, location);
  return live?.evidence ?? null;
}
