'use client';

import { useMemo, useState } from 'react';
import type { MandiHistoryPoint, PriceTrendPoint } from '@/lib/api/market';
import { formatMoney } from '@/lib/format';
import { useLocale } from '@/features/i18n/locale-context';
import type { Locale } from '@/lib/i18n';

interface UnifiedChartPoint {
  id: string;
  source: 'agmarknet' | 'agriconnect';
  dateStr: string;
  pricePerKg: number;
  priceQuintal?: number;
  minPrice?: number;
  maxPrice?: number;
  dataPoints?: number;
  unit?: string;
}

interface PriceHistoryChartProps {
  history: MandiHistoryPoint[];
  trades: PriceTrendPoint[];
}

function formatShortDate(dateStr: string, locale: Locale): string {
  try {
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    return new Intl.DateTimeFormat(`${locale}-IN`, {
      timeZone: 'Asia/Kolkata',
      numberingSystem: 'latn',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string, locale: Locale): string {
  try {
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    return new Intl.DateTimeFormat(`${locale}-IN`, {
      timeZone: 'Asia/Kolkata',
      numberingSystem: 'latn',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function PriceHistoryChart({ history, trades }: PriceHistoryChartProps) {
  const { t, locale } = useLocale();

  const points: UnifiedChartPoint[] = useMemo(() => {
    const list: UnifiedChartPoint[] = [];

    for (const h of history) {
      const pricePerKg = Number(h.avgModalPricePerKg);
      if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) continue;
      list.push({
        id: `mandi-${h.arrivalDate}`,
        source: 'agmarknet',
        dateStr: h.arrivalDate,
        pricePerKg,
        priceQuintal: h.avgModalPrice,
        minPrice: h.avgMinPrice,
        maxPrice: h.avgMaxPrice,
        dataPoints: h.dataPoints,
      });
    }

    for (const tr of trades) {
      const price = Number(tr.pricePerUnit);
      if (!Number.isFinite(price) || price <= 0) continue;
      // In AgriConnect, trade unit is often kg or quintal
      const pricePerKg = tr.unit === 'quintal' ? price / 100 : price;
      list.push({
        id: `trade-${tr.id}`,
        source: 'agriconnect',
        dateStr: tr.recordedAt ? tr.recordedAt.slice(0, 10) : '',
        pricePerKg,
        unit: tr.unit,
      });
    }

    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [history, trades]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default selection is latest point
  const activePoint = useMemo(() => {
    if (selectedId) {
      const found = points.find((p) => p.id === selectedId);
      if (found) return found;
    }
    return points[points.length - 1] ?? null;
  }, [points, selectedId]);

  if (points.length === 0) {
    return <p className="mt-3 text-ink/70">{t('marketPrices.noHistory')}</p>;
  }

  const allPrices = points.map((p) => p.pricePerKg);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const spread = maxPrice - minPrice;

  // Adaptive Y-axis scale with padding for dynamic visual range
  const yMin = spread > 0 ? Math.max(0, Math.floor(minPrice - spread * 0.2)) : Math.max(0, Math.floor(minPrice * 0.8));
  const yMax = spread > 0 ? Math.ceil(maxPrice + spread * 0.15) : Math.ceil(maxPrice * 1.2);
  const yRange = Math.max(yMax - yMin, 1);

  // Trend calculation (first vs last)
  const firstPrice = points[0].pricePerKg;
  const lastPrice = points[points.length - 1].pricePerKg;
  const trendPercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const isUp = trendPercent > 0.5;
  const isDown = trendPercent < -0.5;

  const yTicks = [
    yMax,
    Number((yMin + (yRange * 2) / 3).toFixed(1)),
    Number((yMin + yRange / 3).toFixed(1)),
    yMin,
  ];

  return (
    <div className="mt-4 space-y-4">
      {/* 1. Summary Statistics Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-forest/10 bg-field/50 p-3">
          <p className="text-xs font-medium text-ink/60">{t('marketPrices.latestAvg')}</p>
          <p className="mt-0.5 text-lg font-bold text-forest">
            {formatMoney(lastPrice, locale)} <span className="text-xs font-normal text-ink/60">{t('marketPrices.colPerKg')}</span>
          </p>
        </div>

        <div className="rounded-xl border border-forest/10 bg-field/50 p-3">
          <p className="text-xs font-medium text-ink/60">{t('marketPrices.priceRange')}</p>
          <p className="mt-0.5 text-base font-bold text-forest truncate">
            {formatMoney(minPrice, locale)} – {formatMoney(maxPrice, locale)}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl border border-forest/10 bg-field/50 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-ink/60">{t('marketPrices.trendLabel')}</p>
            <p className="mt-0.5 text-base font-bold text-forest">
              {trendPercent >= 0 ? `+${trendPercent.toFixed(1)}%` : `${trendPercent.toFixed(1)}%`}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
              isUp
                ? 'bg-leaf/15 text-leaf border border-leaf/30'
                : isDown
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-forest/10 text-forest border border-forest/20'
            }`}
          >
            {isUp ? `↑ ${t('marketPrices.trendUp')}` : isDown ? `↓ ${t('marketPrices.trendDown')}` : t('marketPrices.trendSteady')}
          </span>
        </div>
      </div>

      {/* 2. Visual Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-ink/75">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-soil/90 shadow-2xs inline-block" />
            <span className="font-semibold text-soil">{t('marketPrices.legendGovtAvg')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-leaf shadow-2xs inline-block" />
            <span className="font-semibold text-leaf">{t('marketPrices.legendTrades')}</span>
          </div>
        </div>
        <p className="text-xs text-ink/50 italic">
          {t('marketPrices.colPerKg')}
        </p>
      </div>

      {/* 3. Interactive Detail Inspection Banner */}
      {activePoint ? (
        <div className="rounded-xl border border-forest/15 bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50">
              {formatFullDate(activePoint.dateStr, locale)}
            </span>
            <p className="text-sm font-bold text-forest">
              {activePoint.source === 'agmarknet'
                ? t('marketPrices.legendGovtAvg')
                : t('marketPrices.legendTrades')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-end">
            <div>
              <p className="text-xl font-extrabold text-forest">
                {formatMoney(activePoint.pricePerKg, locale)} <span className="text-xs font-semibold text-ink/60">{t('marketPrices.colPerKg')}</span>
              </p>
              {activePoint.priceQuintal ? (
                <p className="text-xs font-semibold text-ink/55">
                  {t('marketPrices.modalPerQuintal', { price: `₹${activePoint.priceQuintal}` })}
                </p>
              ) : null}
            </div>

            {activePoint.minPrice && activePoint.maxPrice ? (
              <div className="hidden sm:block pl-3 border-l border-forest/10 text-start text-xs text-ink/60">
                <p>
                  {t('marketPrices.minMaxSpread', {
                    min: `₹${activePoint.minPrice}`,
                    max: `₹${activePoint.maxPrice}`,
                  })}
                </p>
                {activePoint.dataPoints ? (
                  <p className="font-medium text-forest/80">
                    {t('marketPrices.mandisCount', { count: activePoint.dataPoints })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 4. Chart Canvas with Y-Axis Gridlines & X-Axis Dates */}
      <div className="relative pt-4 pb-2">
        {/* Y-Axis Gridlines */}
        <div className="absolute inset-x-0 top-4 bottom-8 flex flex-col justify-between pointer-events-none">
          {yTicks.map((tick, i) => (
            <div key={`grid-${tick}-${i}`} className="flex items-center w-full">
              <span className="w-12 text-[11px] font-medium text-ink/45 text-end pr-2 select-none">
                ₹{tick}
              </span>
              <div className="flex-1 border-t border-dashed border-forest/15" />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div className="ml-14 flex items-end gap-1.5 sm:gap-2.5 h-56 pt-2 pb-8">
          {points.map((point, index) => {
            const heightPercent = Math.max(
              12,
              Math.min(100, ((point.pricePerKg - yMin) / yRange) * 100),
            );
            const isSelected = activePoint?.id === point.id;
            const isMandi = point.source === 'agmarknet';

            // Show date label on every bar if <=12 bars, or sampled if many
            const showDate =
              points.length <= 12 ||
              index === 0 ||
              index === points.length - 1 ||
              index % Math.ceil(points.length / 8) === 0;

            return (
              <button
                key={point.id}
                type="button"
                onClick={() => setSelectedId(point.id)}
                onMouseEnter={() => setSelectedId(point.id)}
                onFocus={() => setSelectedId(point.id)}
                className="group relative flex-1 min-w-[12px] h-full flex flex-col justify-end items-center focus:outline-hidden"
                aria-label={`${point.dateStr}: ₹${point.pricePerKg}/kg`}
              >
                {/* Price tag on top of bar */}
                <span
                  className={`text-[10px] font-bold mb-1 transition-opacity select-none ${
                    isSelected
                      ? 'text-forest opacity-100 scale-105'
                      : 'text-ink/60 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  ₹{point.pricePerKg.toFixed(1)}
                </span>

                {/* The Bar */}
                <div
                  className={`w-full rounded-t transition-all duration-150 ${
                    isMandi ? 'bg-soil/85 hover:bg-soil' : 'bg-leaf hover:bg-leaf/90'
                  } ${
                    isSelected
                      ? 'ring-2 ring-forest ring-offset-1 shadow-md scale-y-100'
                      : 'opacity-90 hover:opacity-100'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />

                {/* X-Axis Date Label */}
                <div className="absolute -bottom-7 inset-x-0 flex justify-center">
                  {showDate ? (
                    <span
                      className={`text-[10px] font-semibold whitespace-nowrap select-none transition-colors ${
                        isSelected ? 'text-forest font-bold underline' : 'text-ink/50'
                      }`}
                    >
                      {formatShortDate(point.dateStr, locale)}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
