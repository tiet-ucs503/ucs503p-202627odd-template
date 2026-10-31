import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrdersPage from '@/app/orders/page';
import { BUYER } from '../utils/auth-state';
import { okList, order } from '../utils/fixtures';
import { pa, renderWithLocale } from '../utils/render';

vi.mock('@/lib/api/orders', () => ({
  listOrders: vi.fn(() => okList([order])),
}));

describe('orders list in Punjabi', () => {
  it('renders the translated title, status badge, and call to action', async () => {
    renderWithLocale(<OrdersPage />, { user: BUYER });

    expect(await screen.findByText(pa('order.listTitle'))).toBeInTheDocument();
    expect(screen.getByText(pa('order.status.pending'))).toBeInTheDocument();
    expect(screen.getByText(pa('order.openCta'))).toBeInTheDocument();
  });

  it('shows no English copy', async () => {
    renderWithLocale(<OrdersPage />, { user: BUYER });
    await screen.findByText(pa('order.listTitle'));

    expect(screen.queryByText('My orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Open order')).not.toBeInTheDocument();
  });
});
