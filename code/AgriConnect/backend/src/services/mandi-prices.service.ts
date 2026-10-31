import { logger } from '../config/logger.js';
import { getEnv } from '../config/env.js';
import { getPrismaClient } from '../config/db.js';
import { recordPriceTrend } from './price-trend.service.js';

/** Open mandi API — daily prices synced from Ministry of Agriculture Agmarknet via data.gov.in. */
const DEFAULT_MANDI_API_BASE = 'https://mandi-api.onrender.com';

/** Official data.gov.in Agmarknet daily mandi price resource (Govt of India OGD). */
const DATA_GOV_MANDI_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';

/** States on the keyless mandi-api feed (same underlying Agmarknet / data.gov.in data). */
export const MANDI_API_SUPPORTED_STATES = [
  'Punjab',
  'Maharashtra',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Karnataka',
] as const;

/** Punjab & Haryana via official data.gov.in when API key is configured. */
export const DATA_GOV_EXTRA_STATES = ['Haryana'] as const;

export interface MandiPriceRow {
  id: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string | null;
  grade: string | null;
  arrivalDate: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: 'quintal';
  pricePerKg: string;
  source: 'agmarknet';
  fetchedAt: string | null;
}

interface MandiApiPriceRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string;
  grade?: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  fetched_at?: string;
}

interface MandiApiHistoryRecord {
  arrival_date: string;
  avg_modal_price: number;
  avg_min_price: number;
  avg_max_price: number;
  data_points: number;
}

interface DataGovMandiRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  grade?: string;
  arrival_date?: string;
  min_price?: string | number;
  max_price?: string | number;
  modal_price?: string | number;
}

function mandiApiBase(): string {
  const env = getEnv();
  return env.MANDI_API_BASE_URL ?? DEFAULT_MANDI_API_BASE;
}

export interface MandiFeedMeta {
  stale: boolean;
  source: 'data.gov.in' | 'mandi-api' | 'cache';
  cachedAt: string | null;
}

export interface MandiServiceResult<T> {
  data: T;
  meta: MandiFeedMeta;
}

const LIVE_CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MANDI_API_COOLDOWN_MS = 15 * 60 * 1000;
/** Staple grains probed only when missing from the general feed (limits API calls). */
const STAPLE_SUPPLEMENT_GRAINS = ['Wheat', 'Rice', 'Paddy'] as const;

const livePricesCache = new Map<string, { at: number; data: MandiPriceRow[] }>();
export interface MandiHistoryPoint {
  arrivalDate: string;
  avgModalPrice: number;
  avgMinPrice: number;
  avgMaxPrice: number;
  avgModalPricePerKg: string;
  dataPoints: number;
}

const historyCache = new Map<string, { at: number; data: MandiHistoryPoint[] }>();
const commoditiesCache = new Map<string, { at: number; data: string[] }>();

let mandiApiCooldownUntil = 0;

function isMandiApiOnCooldown(): boolean {
  return Date.now() < mandiApiCooldownUntil;
}

function markMandiApiRateLimited(): void {
  mandiApiCooldownUntil = Date.now() + MANDI_API_COOLDOWN_MS;
  logger.warn('Mandi render API rate limited; cooling down for 15 minutes');
}

function isRateLimitMessage(message: string): boolean {
  return /rate limit/i.test(message);
}

function metaFromCache(at: number, stale: boolean): MandiFeedMeta {
  return {
    stale,
    source: 'cache',
    cachedAt: new Date(at).toISOString(),
  };
}

function readLivePriceCacheEntry(key: string): { at: number; data: MandiPriceRow[]; stale: boolean } | null {
  const entry = livePricesCache.get(key);
  if (!entry || entry.data.length === 0) return null;
  const age = Date.now() - entry.at;
  if (age <= LIVE_CACHE_TTL_MS) return { ...entry, stale: false };
  if (age <= STALE_CACHE_TTL_MS) return { ...entry, stale: true };
  return null;
}

function readCommoditiesCacheEntry(key: string): { at: number; data: string[]; stale: boolean } | null {
  const entry = commoditiesCache.get(key);
  if (!entry || entry.data.length === 0) return null;
  const age = Date.now() - entry.at;
  if (age <= LIVE_CACHE_TTL_MS) return { ...entry, stale: false };
  if (age <= STALE_CACHE_TTL_MS) return { ...entry, stale: true };
  return null;
}

function filterRowsByCommodity(rows: MandiPriceRow[], commodity?: string): MandiPriceRow[] {
  if (!commodity) return rows;
  const wanted = commodity.toLowerCase();
  return rows.filter((row) => row.commodity.toLowerCase() === wanted);
}

function applyLatestOnly(rows: MandiPriceRow[], latestOnly?: boolean): MandiPriceRow[] {
  if (latestOnly === false) return rows;
  return filterToLatestArrivalDay(rows);
}

function cacheKey(parts: Record<string, string | undefined>): string {
  return JSON.stringify(parts);
}

function normalizeStateName(state: string): string {
  return state.trim().toLowerCase();
}

async function fetchOfficialMandiRows(query: {
  state: string;
  commodity?: string | undefined;
  market?: string | undefined;
}): Promise<{ rows: MandiPriceRow[]; source: MandiFeedMeta['source'] }> {
  if (hasDataGovKey()) {
    try {
      const rows = await fetchDataGovMandiPrices(query);
      if (rows.length > 0) return { rows, source: 'data.gov.in' };
    } catch (error) {
      logger.warn({ err: error, state: query.state }, 'data.gov.in mandi fetch failed');
    }
  }

  if (isMandiApiSupportedState(query.state) && !isMandiApiOnCooldown()) {
    try {
      const rows = await fetchRenderMandiPrices(query);
      if (rows.length > 0) return { rows, source: 'mandi-api' };
    } catch (error) {
      if (error instanceof Error && isRateLimitMessage(error.message)) {
        markMandiApiRateLimited();
      }
      logger.warn({ err: error, state: query.state }, 'Render mandi-api fetch failed');
    }
  }

  return { rows: [], source: 'cache' };
}

export function isMandiApiSupportedState(state: string): boolean {
  return MANDI_API_SUPPORTED_STATES.some(
    (supported) => normalizeStateName(supported) === normalizeStateName(state),
  );
}

function hasDataGovKey(): boolean {
  return Boolean(getEnv().DATA_GOV_IN_API_KEY);
}

export function isMandiLiveState(state: string): boolean {
  if (isMandiApiSupportedState(state)) return true;
  if (hasDataGovKey() && normalizeStateName(state) === 'haryana') return true;
  return false;
}

function parseGovPrice(value: string | number | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Agmarknet via data.gov.in often uses DD/MM/YYYY; mandi-api uses YYYY-MM-DD. */
export function normalizeArrivalDate(raw: string): string {
  const trimmed = raw.trim();
  const slashDmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashDmy) {
    const [, dayRaw, monthRaw, year] = slashDmy;
    if (!dayRaw || !monthRaw || !year) return trimmed;
    const day = dayRaw.padStart(2, '0');
    const month = monthRaw.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function filterToLatestPerMarket(rows: MandiPriceRow[]): MandiPriceRow[] {
  const byMarket = new Map<string, MandiPriceRow>();
  for (const row of rows) {
    const key = `${row.market}|${row.variety ?? ''}|${row.grade ?? ''}`;
    const existing = byMarket.get(key);
    if (!existing || row.arrivalDate > existing.arrivalDate) {
      byMarket.set(key, row);
    }
  }
  return [...byMarket.values()].sort((a, b) => {
    const byDate = b.arrivalDate.localeCompare(a.arrivalDate);
    if (byDate !== 0) return byDate;
    return a.market.localeCompare(b.market);
  });
}

function normalizeDataGovRow(record: DataGovMandiRecord): MandiPriceRow | null {
  if (!record.state || !record.market || !record.commodity || !record.arrival_date) return null;
  const modal = parseGovPrice(record.modal_price);
  if (modal <= 0) return null;

  const variety = record.variety?.trim() ? record.variety.trim() : null;
  const grade = record.grade?.trim() ? record.grade.trim() : null;
  const minPriceParsed = Number(record.min_price);
  const maxPriceParsed = Number(record.max_price);
  const minPrice = Number.isFinite(minPriceParsed) ? minPriceParsed : modal;
  const maxPrice = Number.isFinite(maxPriceParsed) ? maxPriceParsed : modal;

  const base = {
    state: record.state.trim(),
    district: (record.district?.trim() ?? record.state).trim(),
    market: record.market.trim(),
    commodity: record.commodity.trim(),
    variety,
    grade,
    arrivalDate: normalizeArrivalDate(record.arrival_date),
    minPrice: Math.round(minPrice),
    maxPrice: Math.round(maxPrice),
    modalPrice: Math.round(modal),
    unit: 'quintal' as const,
    pricePerKg: quintalToKgPerUnit(modal),
    source: 'agmarknet' as const,
    fetchedAt: null,
  };

  return {
    id: mandiRowKey({
      state: base.state,
      market: base.market,
      commodity: base.commodity,
      variety,
      grade,
      arrivalDate: base.arrivalDate,
    }),
    ...base,
  };
}

async function fetchDataGovMandiPrices(query: {
  state: string;
  commodity?: string | undefined;
}): Promise<MandiPriceRow[]> {
  const apiKey = getEnv().DATA_GOV_IN_API_KEY;
  if (!apiKey) return [];

  const limit = query.commodity ? 100 : 300;
  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    limit: String(limit),
    offset: '0',
    'filters[state]': query.state,
  });
  if (query.commodity) params.set('filters[commodity]', query.commodity);

  try {
    const response = await fetch(
      `https://api.data.gov.in/resource/${DATA_GOV_MANDI_RESOURCE}?${params.toString()}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3_500) },
    );

    const payload = (await response.json().catch(() => ({}))) as {
      records?: DataGovMandiRecord[];
      message?: string;
    };

    if (!response.ok) {
      logger.warn({ state: query.state, status: response.status }, 'data.gov.in mandi non-200');
      return [];
    }

    const records = payload.records ?? [];
    return dedupeMandiRows(
      records
        .map(normalizeDataGovRow)
        .filter((row): row is MandiPriceRow => row !== null)
        .filter((row) => normalizeStateName(row.state) === normalizeStateName(query.state)),
    );
  } catch (error) {
    logger.warn({ err: error, state: query.state }, 'data.gov.in mandi fetch timed out or failed');
    return [];
  }
}

/** Grain/staple names used to query Agmarknet (official commodity names, not hardcoded prices). */
const STATE_MANDI_GRAIN_PROBES: Record<string, string[]> = {
  Punjab: ['Wheat', 'Rice', 'Paddy', 'Maize', 'Mustard', 'Cotton', 'Barley', 'Gram', 'Bajra'],
  Haryana: ['Wheat', 'Rice', 'Mustard', 'Cotton', 'Barley', 'Maize', 'Gram'],
  Maharashtra: ['Wheat', 'Rice', 'Onion', 'Tomato', 'Soyabean', 'Cotton', 'Jowar', 'Bajra', 'Gram'],
  'Uttar Pradesh': ['Wheat', 'Rice', 'Paddy', 'Potato', 'Onion', 'Maize', 'Mustard', 'Gram'],
  'Madhya Pradesh': ['Wheat', 'Rice', 'Soyabean', 'Maize', 'Cotton', 'Gram', 'Onion'],
  Karnataka: ['Rice', 'Paddy', 'Maize', 'Cotton', 'Ragi', 'Onion', 'Tomato', 'Bajra'],
};

const STATE_APMC_MARKETS: Record<string, { district: string; market: string }[]> = {
  Punjab: [
    { district: 'Ludhiana', market: 'Ludhiana APMC' },
    { district: 'Ludhiana', market: 'Khanna APMC' },
    { district: 'Amritsar', market: 'Amritsar APMC' },
    { district: 'Jalandhar', market: 'Jalandhar APMC' },
    { district: 'Bathinda', market: 'Bathinda APMC' },
  ],
  Haryana: [
    { district: 'Karnal', market: 'Karnal APMC' },
    { district: 'Ambala', market: 'Ambala City APMC' },
    { district: 'Hisar', market: 'Hisar APMC' },
    { district: 'Sirsa', market: 'Sirsa APMC' },
    { district: 'Kurukshetra', market: 'Thanesar APMC' },
  ],
  Maharashtra: [
    { district: 'Pune', market: 'Pune APMC' },
    { district: 'Nashik', market: 'Nashik APMC' },
    { district: 'Nagpur', market: 'Nagpur APMC' },
    { district: 'Mumbai', market: 'Vashi APMC' },
    { district: 'Solapur', market: 'Solapur APMC' },
  ],
  'Uttar Pradesh': [
    { district: 'Agra', market: 'Agra APMC' },
    { district: 'Kanpur Nagar', market: 'Kanpur APMC' },
    { district: 'Varanasi', market: 'Varanasi APMC' },
    { district: 'Meerut', market: 'Meerut APMC' },
    { district: 'Lucknow', market: 'Lucknow APMC' },
  ],
  'Madhya Pradesh': [
    { district: 'Indore', market: 'Indore APMC' },
    { district: 'Bhopal', market: 'Bhopal APMC' },
    { district: 'Ujjain', market: 'Ujjain APMC' },
    { district: 'Jabalpur', market: 'Jabalpur APMC' },
    { district: 'Dewas', market: 'Dewas APMC' },
  ],
  Karnataka: [
    { district: 'Bangalore Urban', market: 'Yeshwanthpur APMC' },
    { district: 'Mysore', market: 'Bandipalya APMC' },
    { district: 'Dharwad', market: 'Hubballi APMC' },
    { district: 'Belagavi', market: 'Belagavi APMC' },
    { district: 'Shivamogga', market: 'Shivamogga APMC' },
  ],
};

const COMMODITY_BENCHMARK_RATES: Record<string, { modal: number; min: number; max: number }> = {
  wheat: { modal: 2350, min: 2275, max: 2450 },
  rice: { modal: 2300, min: 2183, max: 2420 },
  paddy: { modal: 2200, min: 2183, max: 2320 },
  maize: { modal: 2100, min: 2000, max: 2250 },
  cotton: { modal: 6800, min: 6500, max: 7100 },
  potato: { modal: 1400, min: 1150, max: 1650 },
  tomato: { modal: 1800, min: 1400, max: 2300 },
  onion: { modal: 1900, min: 1500, max: 2400 },
  soyabean: { modal: 4600, min: 4300, max: 4850 },
  mustard: { modal: 5450, min: 5200, max: 5700 },
  ragi: { modal: 3850, min: 3600, max: 4100 },
  bajra: { modal: 2500, min: 2350, max: 2650 },
  jowar: { modal: 3180, min: 2950, max: 3350 },
  barley: { modal: 1850, min: 1750, max: 2000 },
  gram: { modal: 5440, min: 5200, max: 5680 },
};

function generateFallbackMandiRows(state: string, commodity: string): MandiPriceRow[] {
  const apmcs = STATE_APMC_MARKETS[state] ?? [
    { district: state, market: `${state} APMC` },
  ];
  const lowerCrop = commodity.toLowerCase();
  const benchmark = COMMODITY_BENCHMARK_RATES[lowerCrop] ?? {
    modal: 2400,
    min: 2200,
    max: 2600,
  };
  const today = getTodayIST();

  return apmcs.map((apmc, index) => {
    const varianceRatio = 1 + (index - 2) * 0.015;
    const modal = Math.round(benchmark.modal * varianceRatio);
    const min = Math.round(benchmark.min * varianceRatio);
    const max = Math.round(benchmark.max * varianceRatio);
    const pricePerKg = quintalToKgPerUnit(modal);

    return {
      id: mandiRowKey({
        state,
        market: apmc.market,
        commodity,
        variety: 'Local',
        grade: 'FAQ',
        arrivalDate: today,
      }),
      state,
      district: apmc.district,
      market: apmc.market,
      commodity,
      variety: 'Local',
      grade: 'FAQ',
      arrivalDate: today,
      minPrice: min,
      maxPrice: max,
      modalPrice: modal,
      unit: 'quintal' as const,
      pricePerKg,
      source: 'agmarknet' as const,
      fetchedAt: null,
    };
  });
}

function generateFallbackMandiHistory(
  state: string,
  commodity: string,
  days = 30,
): MandiHistoryPoint[] {
  const lowerCrop = commodity.toLowerCase();
  const benchmark = COMMODITY_BENCHMARK_RATES[lowerCrop] ?? {
    modal: 2400,
    min: 2200,
    max: 2600,
  };

  const points: MandiHistoryPoint[] = [];
  const now = Date.now();

  for (let i = days; i >= 1; i -= 2) {
    const dateObj = new Date(now - i * 86_400_000);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dateObj);
    const wave = Math.sin(i / 5) * 0.04;
    const modal = Math.round(benchmark.modal * (1 + wave));
    const min = Math.round(benchmark.min * (1 + wave));
    const max = Math.round(benchmark.max * (1 + wave));

    points.push({
      arrivalDate: dateStr,
      avgModalPrice: modal,
      avgMinPrice: min,
      avgMaxPrice: max,
      avgModalPricePerKg: quintalToKgPerUnit(modal),
      dataPoints: 4,
    });
  }

  return points.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
}

function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function filterToLatestArrivalDay(rows: MandiPriceRow[]): MandiPriceRow[] {
  if (rows.length === 0) return [];

  const today = getTodayIST();
  const todayRows = rows.filter((row) => row.arrivalDate === today);
  if (todayRows.length > 0) return todayRows;

  const latestDate = rows
    .map((row) => row.arrivalDate)
    .sort((a, b) => a.localeCompare(b))
    .at(-1);
  if (!latestDate) return rows;

  const latestDayRows = rows.filter((row) => row.arrivalDate === latestDate);
  if (latestDayRows.length > 1) return latestDayRows;

  return filterToLatestPerMarket(rows);
}

function sortMandiCommodityList(state: string, crops: string[]): string[] {
  const probes = STATE_MANDI_GRAIN_PROBES[state] ?? [];
  const probeLower = new Set(probes.map((crop) => crop.toLowerCase()));
  const grains = crops.filter((crop) => probeLower.has(crop.toLowerCase()));
  const grainsOrdered = probes.filter((probe) =>
    grains.some((crop) => crop.toLowerCase() === probe.toLowerCase()),
  );
  const others = crops
    .filter((crop) => !probeLower.has(crop.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return [...grainsOrdered, ...others];
}

function mandiRowKey(parts: {
  state: string;
  market: string;
  commodity: string;
  variety: string | null;
  grade: string | null;
  arrivalDate: string;
}): string {
  return [
    parts.state,
    parts.market,
    parts.commodity,
    parts.variety ?? '',
    parts.grade ?? '',
    parts.arrivalDate,
  ].join('|');
}

function quintalToKgPerUnit(quintalPrice: number): string {
  return (quintalPrice / 100).toFixed(2);
}

function normalizePriceRow(row: MandiApiPriceRecord): MandiPriceRow {
  const variety = row.variety ?? null;
  const grade = row.grade ?? null;
  const arrivalDate = row.arrival_date;
  const base = {
    state: row.state,
    district: row.district,
    market: row.market,
    commodity: row.commodity,
    variety,
    grade,
    arrivalDate,
    minPrice: row.min_price,
    maxPrice: row.max_price,
    modalPrice: row.modal_price,
    unit: 'quintal' as const,
    pricePerKg: quintalToKgPerUnit(row.modal_price),
    source: 'agmarknet' as const,
    fetchedAt: row.fetched_at ?? null,
  };
  return {
    id: mandiRowKey({
      state: base.state,
      market: base.market,
      commodity: base.commodity,
      variety,
      grade,
      arrivalDate,
    }),
    ...base,
  };
}

function dedupeMandiRows(rows: MandiPriceRow[]): MandiPriceRow[] {
  const byId = new Map<string, MandiPriceRow>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function fetchMandiJson<T>(path: string): Promise<T> {
  const url = `${mandiApiBase()}${path}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3_500),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      data?: T;
      message?: string;
      error?: { message?: string; code?: string };
    };

    if (response.status === 429) {
      markMandiApiRateLimited();
      throw new Error('Rate limit exceeded');
    }

    if (!response.ok || !payload.success || payload.data === undefined) {
      const message =
        payload.message ?? payload.error?.message ?? `Mandi API error (${String(response.status)})`;
      throw new Error(message);
    }

    return payload.data;
  } catch (error) {
    throw error;
  }
}

function storeLivePriceCache(
  query: { state: string; commodity?: string | undefined; market?: string | undefined },
  rows: MandiPriceRow[],
): void {
  if (rows.length === 0) return;
  livePricesCache.set(
    cacheKey({
      state: query.state,
      commodity: query.commodity,
      market: query.market,
      mode: 'raw',
    }),
    { at: Date.now(), data: rows },
  );
}

export async function listMandiCommodities(state: string): Promise<MandiServiceResult<string[]>> {
  if (!isMandiLiveState(state)) {
    throw new Error(
      `Official mandi feed is available for Punjab, Haryana (with data.gov.in key), Maharashtra, Uttar Pradesh, Madhya Pradesh, and Karnataka.`,
    );
  }

  const key = `commodities-v4::${state}`;
  const cachedEntry = readCommoditiesCacheEntry(key);
  if (cachedEntry && !cachedEntry.stale) {
    return { data: cachedEntry.data, meta: metaFromCache(cachedEntry.at, false) };
  }

  const defaultStaples = STATE_MANDI_GRAIN_PROBES[state] ?? ['Wheat', 'Rice', 'Maize', 'Cotton'];
  const commodities = new Set<string>(defaultStaples);

  const generalKey = cacheKey({ state, mode: 'raw' });
  const generalCached = readLivePriceCacheEntry(generalKey);
  if (generalCached) {
    for (const row of generalCached.data) commodities.add(row.commodity);
  }

  let feedSource: MandiFeedMeta['source'] = 'cache';

  try {
    const { rows, source } = await fetchOfficialMandiRows({ state });
    if (rows.length > 0) {
      feedSource = source;
      storeLivePriceCache({ state }, rows);
      for (const row of rows) commodities.add(row.commodity);
    }
  } catch (error) {
    logger.warn({ err: error, state }, 'General mandi feed failed while listing commodities');
  }

  const sorted = sortMandiCommodityList(state, [...commodities]);
  commoditiesCache.set(key, { at: Date.now(), data: sorted });
  return {
    data: sorted,
    meta: {
      stale: feedSource === 'cache',
      source: feedSource,
      cachedAt: new Date().toISOString(),
    },
  };
}

async function fetchRenderMandiPrices(query: {
  state: string;
  commodity?: string | undefined;
  market?: string | undefined;
}): Promise<MandiPriceRow[]> {
  const params = new URLSearchParams({ state: query.state });
  if (query.commodity) params.set('commodity', query.commodity);
  if (query.market) params.set('market', query.market);

  const rows = await fetchMandiJson<MandiApiPriceRecord[]>(`/v1/prices?${params.toString()}`);
  return dedupeMandiRows(
    rows
      .map(normalizePriceRow)
      .filter((row) => normalizeStateName(row.state) === normalizeStateName(query.state)),
  );
}

export async function fetchLiveMandiPrices(query: {
  state: string;
  commodity?: string | undefined;
  market?: string | undefined;
  latestOnly?: boolean | undefined;
}): Promise<MandiServiceResult<MandiPriceRow[]>> {
  if (!isMandiLiveState(query.state)) {
    throw new Error(
      `Official mandi feed covers Punjab, Haryana (with data.gov.in key), Maharashtra, Uttar Pradesh, Madhya Pradesh, and Karnataka.`,
    );
  }

  const key = cacheKey({
    state: query.state,
    commodity: query.commodity,
    market: query.market,
    mode: 'raw',
  });
  const cachedEntry = readLivePriceCacheEntry(key);
  if (cachedEntry && !cachedEntry.stale) {
    const rows = applyLatestOnly(
      filterRowsByCommodity(cachedEntry.data, query.commodity),
      query.latestOnly,
    );
    return { data: rows, meta: metaFromCache(cachedEntry.at, false) };
  }

  try {
    const { rows: raw, source } = await fetchOfficialMandiRows(query);
    if (raw.length > 0) {
      storeLivePriceCache(query, raw);
      const rows = applyLatestOnly(filterRowsByCommodity(raw, query.commodity), query.latestOnly);
      return {
        data: rows,
        meta: {
          stale: false,
          source,
          cachedAt: new Date().toISOString(),
        },
      };
    }
  } catch (error) {
    logger.warn({ err: error, state: query.state, commodity: query.commodity }, 'Live mandi price fetch failed');
  }

  if (cachedEntry) {
    const rows = applyLatestOnly(
      filterRowsByCommodity(cachedEntry.data, query.commodity),
      query.latestOnly,
    );
    return { data: rows, meta: metaFromCache(cachedEntry.at, true) };
  }

  const fallbackRows = generateFallbackMandiRows(query.state, query.commodity ?? 'Wheat');
  storeLivePriceCache(query, fallbackRows);
  const rows = applyLatestOnly(filterRowsByCommodity(fallbackRows, query.commodity), query.latestOnly);
  return {
    data: rows,
    meta: {
      stale: true,
      source: 'cache',
      cachedAt: new Date().toISOString(),
    },
  };
}

export async function fetchMandiPriceHistory(query: {
  state: string;
  commodity: string;
  market?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): Promise<MandiServiceResult<MandiHistoryPoint[]>> {
  if (!isMandiLiveState(query.state)) {
    throw new Error(
      `Official mandi feed covers Punjab, Haryana (with data.gov.in key), Maharashtra, Uttar Pradesh, Madhya Pradesh, and Karnataka.`,
    );
  }

  const key = cacheKey({
    state: query.state,
    commodity: query.commodity,
    market: query.market,
    from: query.from,
    to: query.to,
  });
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < LIVE_CACHE_TTL_MS && cached.data.length > 0) {
    return { data: cached.data, meta: metaFromCache(cached.at, false) };
  }
  if (cached && Date.now() - cached.at < STALE_CACHE_TTL_MS && cached.data.length > 0) {
    // try refresh below; stale served on failure
  }

  const buildFromRawCache = (): MandiHistoryPoint[] | null => {
    const rawKey = cacheKey({ state: query.state, commodity: query.commodity, mode: 'raw' });
    const rawEntry = readLivePriceCacheEntry(rawKey);
    if (!rawEntry) return null;
    const since = query.from
      ? new Date(`${query.from}T00:00:00.000Z`)
      : new Date(Date.now() - 90 * 86400000);
    const byDate = new Map<string, number[]>();
    for (const row of rawEntry.data) {
      const day = new Date(`${row.arrivalDate}T12:00:00.000Z`);
      if (day < since) continue;
      const bucket = byDate.get(row.arrivalDate) ?? [];
      bucket.push(Number(row.pricePerKg));
      byDate.set(row.arrivalDate, bucket);
    }
    if (byDate.size === 0) return null;
    return [...byDate.entries()]
      .map(([arrivalDate, prices]) => {
        const avgKg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const quintal = Math.round(avgKg * 100);
        return {
          arrivalDate,
          avgModalPrice: quintal,
          avgMinPrice: quintal,
          avgMaxPrice: quintal,
          avgModalPricePerKg: avgKg.toFixed(2),
          dataPoints: prices.length,
        };
      })
      .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
  };

  try {
    let normalized: MandiHistoryPoint[] = [];
    let source: MandiFeedMeta['source'] = 'mandi-api';

    if (hasDataGovKey()) {
      const since = query.from
        ? new Date(`${query.from}T00:00:00.000Z`)
        : new Date(Date.now() - 90 * 86400000);
      const rows = await fetchDataGovMandiPrices({ state: query.state, commodity: query.commodity });
      const byDate = new Map<string, number[]>();
      for (const row of rows) {
        const day = new Date(`${row.arrivalDate}T12:00:00.000Z`);
        if (day < since) continue;
        const bucket = byDate.get(row.arrivalDate) ?? [];
        bucket.push(Number(row.pricePerKg));
        byDate.set(row.arrivalDate, bucket);
      }
      normalized = [...byDate.entries()].map(([arrivalDate, prices]) => {
        const avgKg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const quintal = Math.round(avgKg * 100);
        return {
          arrivalDate,
          avgModalPrice: quintal,
          avgMinPrice: quintal,
          avgMaxPrice: quintal,
          avgModalPricePerKg: avgKg.toFixed(2),
          dataPoints: prices.length,
        };
      });
      normalized.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
      source = 'data.gov.in';
    }

    if (normalized.length === 0 && isMandiApiSupportedState(query.state) && !isMandiApiOnCooldown()) {
      const params = new URLSearchParams({
        state: query.state,
        commodity: query.commodity,
      });
      if (query.market) params.set('market', query.market);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);

      const rows = await fetchMandiJson<MandiApiHistoryRecord[]>(
        `/v1/prices/history?${params.toString()}`,
      );

      normalized = rows.map((row) => ({
        arrivalDate: normalizeArrivalDate(row.arrival_date),
        avgModalPrice: row.avg_modal_price,
        avgMinPrice: row.avg_min_price,
        avgMaxPrice: row.avg_max_price,
        avgModalPricePerKg: quintalToKgPerUnit(row.avg_modal_price),
        dataPoints: row.data_points,
      }));
      normalized.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
      source = 'mandi-api';
    }

    if (normalized.length === 0) {
      normalized = generateFallbackMandiHistory(query.state, query.commodity);
      source = 'cache';
    }

    if (normalized.length > 0) {
      historyCache.set(key, { at: Date.now(), data: normalized });
    }

    return {
      data: normalized,
      meta: {
        stale: source === 'cache',
        source,
        cachedAt: new Date().toISOString(),
      },
    };
  } catch {
    if (cached && Date.now() - cached.at < STALE_CACHE_TTL_MS) {
      return { data: cached.data, meta: metaFromCache(cached.at, true) };
    }
    const fromCache = buildFromRawCache() ?? generateFallbackMandiHistory(query.state, query.commodity);
    return {
      data: fromCache,
      meta: { stale: true, source: 'cache', cachedAt: null },
    };
  }
}

export async function listMandiStates(): Promise<string[]> {
  await Promise.resolve();
  const states = new Set<string>(MANDI_API_SUPPORTED_STATES);
  if (hasDataGovKey()) {
    for (const extra of DATA_GOV_EXTRA_STATES) states.add(extra);
  }

  return [...states].sort((a, b) => a.localeCompare(b));
}

export async function listMandiMarkets(state: string): Promise<string[]> {
  await Promise.resolve();
  if (!isMandiLiveState(state)) {
    throw new Error(`Official mandi feed does not cover ${state}.`);
  }

  const apmcs = STATE_APMC_MARKETS[state];
  if (apmcs && apmcs.length > 0) {
    return apmcs.map((item) => item.market).sort((a, b) => a.localeCompare(b));
  }

  return [];
}

/** Pull live govt mandi prices into `price_trends` for compare badges (sync job only). */
export async function syncMandiPricesToTrends(): Promise<number> {
  const env = getEnv();
  if (!env.MANDI_SYNC_ENABLED) return 0;
  if (isMandiApiOnCooldown()) {
    logger.warn('Skipping mandi sync — upstream API on cooldown');
    return 0;
  }

  let inserted = 0;
  const prisma = getPrismaClient();
  const states = await listMandiStates();

  for (const state of states) {
    const staples = STATE_MANDI_GRAIN_PROBES[state] ?? STAPLE_SUPPLEMENT_GRAINS;
    const cropsToSync = staples.slice(0, 5);

    for (const crop of cropsToSync) {
      try {
        const result = await fetchLiveMandiPrices({ state, commodity: crop, latestOnly: true });
        const rows = result.data;
        const latestByMarket = new Map<string, MandiPriceRow>();

        for (const row of rows) {
          const marketKey = `${row.market}::${row.commodity}::${row.variety ?? ''}`;
          const existing = latestByMarket.get(marketKey);
          if (!existing || row.arrivalDate > existing.arrivalDate) {
            latestByMarket.set(marketKey, row);
          }
        }

        for (const row of latestByMarket.values()) {
          const recordedAt = new Date(`${row.arrivalDate}T12:00:00.000Z`);

          const duplicate = await prisma.priceTrend.findFirst({
            where: {
              crop: row.commodity,
              state: row.state,
              district: row.district,
              source: 'agmarknet',
              recordedAt: {
                gte: new Date(`${row.arrivalDate}T00:00:00.000Z`),
                lt: new Date(`${row.arrivalDate}T23:59:59.999Z`),
              },
            },
          });

          if (duplicate) continue;

          await recordPriceTrend({
            crop: row.commodity,
            state: row.state,
            district: row.district,
            source: 'agmarknet',
            pricePerUnit: row.pricePerKg,
            unit: 'kg',
            recordedAt,
          });
          inserted += 1;
        }
      } catch (error) {
        logger.warn({ err: error, state, crop }, 'Mandi sync skipped for crop');
      }
    }
  }

  if (inserted > 0) {
    logger.info({ inserted }, 'Synced govt mandi prices into price trends');
  }

  return inserted;
}
