import type { ListingStatus, Prisma } from '../../generated/prisma/client.js';

type DatabaseClient = Prisma.TransactionClient;

export function listingStatusAfterQuantity(
  quantity: Prisma.Decimal,
  minimumOrderQuantity: Prisma.Decimal,
  currentStatus: ListingStatus,
): ListingStatus {
  if (currentStatus === 'removed' || currentStatus === 'expired' || currentStatus === 'draft') {
    return currentStatus;
  }
  if (quantity.lessThanOrEqualTo(0) || quantity.lessThan(minimumOrderQuantity)) {
    return 'sold_out';
  }
  if (currentStatus === 'sold_out') {
    return 'active';
  }
  return currentStatus;
}

export async function restoreListingStock(
  transaction: DatabaseClient,
  listingId: string,
  quantity: Prisma.Decimal,
): Promise<void> {
  const listing = await transaction.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing || listing.deletedAt || listing.status === 'removed') {
    return;
  }
  const nextQuantity = listing.quantity.plus(quantity);
  const nextStatus = listingStatusAfterQuantity(
    nextQuantity,
    listing.minimumOrderQuantity,
    listing.status,
  );

  await transaction.listing.update({
    where: { id: listingId },
    data: {
      quantity: nextQuantity,
      status: nextStatus,
    },
  });
}
