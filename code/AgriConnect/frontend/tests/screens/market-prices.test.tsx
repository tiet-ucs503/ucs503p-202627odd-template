import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceHistoryChart } from '@/app/market-prices/PriceHistoryChart';
import type { MandiHistoryPoint, PriceTrendPoint } from '@/lib/api/market';
import { pa, renderWithLocale } from '../utils/render';

const mockHistory: MandiHistoryPoint[] = [
  {
    arrivalDate: '2026-11-18',
    avgModalPrice: 2231,
    avgMinPrice: 2118,
    avgMaxPrice: 2347,
    avgModalPricePerKg: '22.31',
    dataPoints: 12,
  },
  {
    arrivalDate: '2026-11-20',
    avgModalPrice: 2266,
    avgMinPrice: 2150,
    avgMaxPrice: 2384,
    avgModalPricePerKg: '22.66',
    dataPoints: 14,
  },
];

const mockTrades: PriceTrendPoint[] = [
  {
    id: 'trade-1',
    crop: 'wheat',
    state: 'Punjab',
    district: 'Ludhiana',
    source: 'agriconnect',
    pricePerUnit: '23.20',
    unit: 'kg',
    recordedAt: '2026-11-22T10:00:00.000Z',
  },
];

describe('PriceHistoryChart component', () => {
  it('renders summary stats, legends, and axis labels in Punjabi', () => {
    renderWithLocale(<PriceHistoryChart history={mockHistory} trades={mockTrades} />, {
      locale: 'pa',
    });

    // Check legend items (may appear in legend and active card)
    expect(screen.getAllByText(pa('marketPrices.legendGovtAvg')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(pa('marketPrices.legendTrades')).length).toBeGreaterThanOrEqual(1);

    // Check summary label
    expect(screen.getByText(pa('marketPrices.latestAvg'))).toBeInTheDocument();
    expect(screen.getByText(pa('marketPrices.priceRange'))).toBeInTheDocument();

    // Check dates rendered
    expect(screen.getAllByText(/18/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/22/).length).toBeGreaterThanOrEqual(1);
  });

  it('updates inspection card when a bar is hovered or focused', () => {
    renderWithLocale(<PriceHistoryChart history={mockHistory} trades={mockTrades} />, {
      locale: 'en',
    });

    const bars = screen.getAllByRole('button');
    expect(bars.length).toBeGreaterThanOrEqual(3);

    // Hover first bar
    fireEvent.mouseEnter(bars[0]);
    expect(screen.getAllByText(/22\.31/).length).toBeGreaterThanOrEqual(1);

    // Focus third bar (agriconnect trades)
    fireEvent.focus(bars[2]);
    expect(screen.getAllByText(/23\.20/).length).toBeGreaterThanOrEqual(1);
  });
});
