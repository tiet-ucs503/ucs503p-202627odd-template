import { moneyString } from '../../common/decimal.js';
import { getPrismaClient } from '../../config/db.js';
import type { PriceTrendQuery } from './market.schema.js';

export async function listPriceTrends(query: PriceTrendQuery) {
  const since = new Date();
  since.setDate(since.getDate() - query.days);

  const rows = await getPrismaClient().priceTrend.findMany({
    where: {
      recordedAt: { gte: since },
      ...(query.crop ? { crop: query.crop } : {}),
      ...(query.state ? { state: query.state } : {}),
    },
    orderBy: { recordedAt: 'asc' },
    take: query.limit,
  });

  return rows.map((row) => ({
    id: row.id,
    crop: row.crop,
    state: row.state,
    district: row.district,
    source: row.source,
    pricePerUnit: moneyString(row.pricePerUnit),
    unit: row.unit,
    recordedAt: row.recordedAt.toISOString(),
  }));
}

export async function getPriceTrendSummary(query: PriceTrendQuery) {
  const points = await listPriceTrends({ ...query, limit: 500 });
  const byCrop = new Map<
    string,
    {
      crop: string;
      state: string;
      unit: string;
      pricePerUnit: string;
      source: string;
      recordedAt: string;
    }
  >();

  for (const point of points) {
    const key = `${point.crop}::${point.state}`;
    const existing = byCrop.get(key);
    if (!existing || point.recordedAt > existing.recordedAt) {
      byCrop.set(key, {
        crop: point.crop,
        state: point.state,
        unit: point.unit,
        pricePerUnit: point.pricePerUnit,
        source: point.source,
        recordedAt: point.recordedAt,
      });
    }
  }

  return [...byCrop.values()];
}

export type MandiCompareVerdict = 'below_mandi' | 'above_mandi' | 'at_mandi' | 'unknown';

export function listingPricePerKg(pricePerUnit: string, unit: 'kg' | 'quintal' | 'ton'): number {
  const price = Number(pricePerUnit);
  if (unit === 'quintal') return price / 100;
  if (unit === 'ton') return price / 1000;
  return price;
}

async function getMandiReferencePerKg(crop: string, state: string): Promise<number | null> {
  const prisma = getPrismaClient();
  const row = await prisma.priceTrend.findFirst({
    where: {
      state,
      source: 'agmarknet',
      unit: 'kg',
      crop: { equals: crop, mode: 'insensitive' },
    },
    orderBy: { recordedAt: 'desc' },
  });
  if (!row) return null;
  return Number(moneyString(row.pricePerUnit));
}

export async function compareListingsToMandi(
  items: {
    id: string;
    crop: string;
    state: string;
    pricePerUnit: string;
    unit: 'kg' | 'quintal' | 'ton';
  }[],
) {
  const results: {
    id: string;
    listingPricePerKg: string;
    mandiPricePerKg: string | null;
    diffPerKg: string | null;
    diffPercent: number | null;
    verdict: MandiCompareVerdict;
  }[] = [];

  for (const item of items) {
    const listingKg = listingPricePerKg(item.pricePerUnit, item.unit);
    const mandiKg = await getMandiReferencePerKg(item.crop, item.state);

    if (mandiKg === null || !Number.isFinite(mandiKg)) {
      results.push({
        id: item.id,
        listingPricePerKg: listingKg.toFixed(2),
        mandiPricePerKg: null,
        diffPerKg: null,
        diffPercent: null,
        verdict: 'unknown',
      });
      continue;
    }

    const diff = listingKg - mandiKg;
    const diffPercent = mandiKg > 0 ? Math.round((diff / mandiKg) * 100) : 0;
    let verdict: MandiCompareVerdict = 'at_mandi';
    if (diffPercent <= -2) verdict = 'below_mandi';
    else if (diffPercent >= 2) verdict = 'above_mandi';

    results.push({
      id: item.id,
      listingPricePerKg: listingKg.toFixed(2),
      mandiPricePerKg: mandiKg.toFixed(2),
      diffPerKg: diff.toFixed(2),
      diffPercent,
      verdict,
    });
  }

  return results;
}
