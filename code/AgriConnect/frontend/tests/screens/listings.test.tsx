import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ListingDetailPage from '@/app/listings/[id]/page';
import MarketplacePage from '@/app/marketplace/page';
import { ListingForm } from '@/features/listings/listing-form';
import { BUYER, FARMER } from '../utils/auth-state';
import { listing, ok, okList } from '../utils/fixtures';
import { pa, renderWithLocale } from '../utils/render';

vi.mock('@/lib/api/listings', () => ({
  getListing: vi.fn(() => ok(listing)),
  listListings: vi.fn(() => okList([listing])),
  createListing: vi.fn(() => ok(listing)),
  updateListing: vi.fn(() => ok(listing)),
  uploadListingPhotos: vi.fn(() => ok(listing)),
}));

vi.mock('@/lib/api/orders', () => ({
  createOrder: vi.fn(() => ok({ id: 'order-1' })),
}));

vi.mock('@/lib/api/market', () => ({
  compareListingPrices: vi.fn(() => okList([])),
}));

vi.mock('@/lib/api/bids', () => ({
  listListingBids: vi.fn(() => okList([])),
  listMyBids: vi.fn(() => okList([])),
  createBid: vi.fn(),
  acceptBid: vi.fn(),
  rejectBid: vi.fn(),
  counterBid: vi.fn(),
  withdrawBid: vi.fn(),
}));

describe('listing detail in Punjabi', () => {
  it('translates availability, harvest, and the order form', async () => {
    renderWithLocale(<ListingDetailPage />, { user: BUYER });

    expect(
      await screen.findByText(
        pa('listing.availableLine', { qty: '100 ਕੁਇੰਟਲ', min: '10 ਕੁਇੰਟਲ' }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: pa('listing.place.title') }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(pa('listing.place.quantity', { unit: pa('units.quintal') })),
    ).toBeInTheDocument();
    expect(screen.getByText(pa('listing.place.pickupOption'))).toBeInTheDocument();
    expect(screen.queryByText('Place order')).not.toBeInTheDocument();
  });
});

describe('marketplace in Punjabi', () => {
  it('translates filters, sort options, and listing cards', async () => {
    renderWithLocale(<MarketplacePage />);

    expect(await screen.findByText(pa('marketplace.title'))).toBeInTheDocument();
    expect(screen.getByText(pa('marketplace.apply'))).toBeInTheDocument();
    expect(screen.getByRole('option', { name: pa('marketplace.sortNewest') })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: pa('listing.category.grains') }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Apply filters')).not.toBeInTheDocument();
  });
});

describe('listing form in Punjabi', () => {
  it('translates every field label and the submit button', () => {
    renderWithLocale(<ListingForm />, { user: FARMER });

    expect(screen.getByText(pa('listing.form.crop'))).toBeInTheDocument();
    expect(screen.getByText(pa('listing.form.category'))).toBeInTheDocument();
    expect(screen.getByText(pa('listing.form.quantity'))).toBeInTheDocument();
    expect(screen.getByText(pa('listing.form.pricePerUnit'))).toBeInTheDocument();
    expect(screen.getByText(pa('listing.form.harvestDate'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pa('listing.form.create') })).toBeInTheDocument();
    expect(screen.queryByText('Crop')).not.toBeInTheDocument();
  });
});
