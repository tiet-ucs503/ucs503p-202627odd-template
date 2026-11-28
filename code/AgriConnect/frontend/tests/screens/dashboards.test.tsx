import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BuyerPage from '@/app/buyer/page';
import FarmerPage from '@/app/farmer/page';
import { BUYER, FARMER } from '../utils/auth-state';
import { listing, okList } from '../utils/fixtures';
import { pa, renderWithLocale } from '../utils/render';

const report = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@/lib/api/reports', () => ({
  getMyReport: vi.fn(() => Promise.resolve({ data: report.current })),
}));

vi.mock('@/lib/api/orders', () => ({
  listOrders: vi.fn(() => okList([])),
}));

vi.mock('@/lib/api/listings', () => ({
  listListings: vi.fn(() => okList([listing])),
}));

describe('farmer dashboard in Punjabi', () => {
  it('translates the header and the summary cards', async () => {
    report.current = {
      role: 'FARMER',
      revenue: '120000',
      totalQuantitySold: '40',
      listingsCount: 3,
      topListings: [],
    };
    renderWithLocale(<FarmerPage />, { user: FARMER });

    expect(await screen.findByText(pa('dashboard.farmerTitle'))).toBeInTheDocument();
    expect(screen.getByText(pa('dashboard.revenue'))).toBeInTheDocument();
    expect(screen.getByText(pa('dashboard.listings'))).toBeInTheDocument();
    expect(screen.queryByText('Farmer desk')).not.toBeInTheDocument();
  });
});

describe('buyer dashboard in Punjabi', () => {
  it('translates the header and the summary cards', async () => {
    report.current = { role: 'BUYER', totalSpend: '44000', ordersCount: 2, topCrops: [] };
    renderWithLocale(<BuyerPage />, { user: BUYER });

    expect(await screen.findByText(pa('dashboard.buyerTitle'))).toBeInTheDocument();
    expect(screen.getByText(pa('dashboard.spend'))).toBeInTheDocument();
    expect(screen.getByText(pa('dashboard.browseProduce'))).toBeInTheDocument();
    expect(screen.queryByText('Buyer desk')).not.toBeInTheDocument();
  });
});