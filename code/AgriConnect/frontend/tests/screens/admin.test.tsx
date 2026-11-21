import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminHomePage from '@/app/admin/page';
import AdminListingsPage from '@/app/admin/listings/page';
import AdminLogsPage from '@/app/admin/logs/page';
import AdminUsersPage from '@/app/admin/users/page';
import { ADMIN } from '../utils/auth-state';
import { listing, ok, okList } from '../utils/fixtures';
import { pa, renderWithLocale } from '../utils/render';

const adminUser = {
  id: 'user-9',
  name: 'Gurpreet Singh',
  email: 'farmer@example.test',
  role: 'FARMER',
  verified: false,
  isSuspended: false,
  state: 'Punjab',
  district: 'Ludhiana',
  createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('@/lib/api/admin', () => ({
  getAdminAnalytics: vi.fn(() =>
    ok({ totalUsers: 12, totalListings: 8, activeListings: 5, totalOrders: 3, gmv: '90000' }),
  ),
  listAdminUsers: vi.fn(() => okList([adminUser])),
  suspendUser: vi.fn(() => ok(adminUser)),
  verifyUser: vi.fn(() => ok(adminUser)),
  moderateListing: vi.fn(() => ok(listing)),
  listActivityLogs: vi.fn(() => okList([])),
}));

vi.mock('@/lib/api/listings', () => ({
  listListings: vi.fn(() => okList([listing])),
}));

describe('admin screens in Punjabi', () => {
  it('translates the overview cards', async () => {
    renderWithLocale(<AdminHomePage />, { user: ADMIN });

    expect(await screen.findByText(pa('admin.overviewTitle'))).toBeInTheDocument();
    expect(screen.getByText(pa('admin.users'))).toBeInTheDocument();
    expect(screen.getByText(pa('admin.gmv'))).toBeInTheDocument();
    expect(screen.queryByText('Admin overview')).not.toBeInTheDocument();
  });

  it('translates the user desk badges and actions', async () => {
    renderWithLocale(<AdminUsersPage />, { user: ADMIN });

    expect(await screen.findByRole('heading', { name: pa('admin.users') })).toBeInTheDocument();
    expect(screen.getByText(pa('admin.unverified'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pa('admin.suspend') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pa('admin.verify') })).toBeInTheDocument();
  });

  it('translates listing moderation controls', async () => {
    renderWithLocale(<AdminListingsPage />, { user: ADMIN });

    expect(await screen.findByText(pa('admin.moderationTitle'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pa('common.filter') })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: pa('listing.status.active') })).toBeInTheDocument();
  });

  it('translates the empty activity log', async () => {
    renderWithLocale(<AdminLogsPage />, { user: ADMIN });

    expect(await screen.findByText(pa('admin.logsTitle'))).toBeInTheDocument();
    expect(screen.getByText(pa('admin.logsEmptyTitle'))).toBeInTheDocument();
    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
  });
});
