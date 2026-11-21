import { Prisma } from '../../generated/prisma/client.js';
import { listingStatusAfterQuantity } from './inventory.js';

describe('listing inventory status', () => {
  const moq = new Prisma.Decimal('50');

  it('marks active listings sold_out when remaining quantity is below MOQ', () => {
    expect(
      listingStatusAfterQuantity(new Prisma.Decimal('40'), moq, 'active'),
    ).toBe('sold_out');
    expect(
      listingStatusAfterQuantity(new Prisma.Decimal('0'), moq, 'active'),
    ).toBe('sold_out');
  });

  it('reactivates sold_out listings when restored stock meets MOQ', () => {
    expect(
      listingStatusAfterQuantity(new Prisma.Decimal('50'), moq, 'sold_out'),
    ).toBe('active');
  });

  it('keeps expired and removed listings in place after stock changes', () => {
    expect(
      listingStatusAfterQuantity(new Prisma.Decimal('80'), moq, 'expired'),
    ).toBe('expired');
    expect(
      listingStatusAfterQuantity(new Prisma.Decimal('80'), moq, 'removed'),
    ).toBe('removed');
  });
});
