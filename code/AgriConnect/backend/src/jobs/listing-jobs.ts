import { getPrismaClient } from '../config/db.js';
import {
  notifyFarmerListingExpiring,
} from '../services/listing-notifications.service.js';
import { expireDueListings } from '../modules/listings/listings.service.js';

export async function processListingExpiryWarnings(): Promise<number> {
  const prisma = getPrismaClient();
  const now = new Date();
  const inThreeDays = new Date(now);
  inThreeDays.setDate(inThreeDays.getDate() + 3);

  const listings = await prisma.listing.findMany({
    where: {
      status: 'active',
      deletedAt: null,
      expiresAt: { gte: now, lte: inThreeDays },
    },
    include: {
      farmerProfile: { select: { userId: true } },
    },
  });

  let sent = 0;
  for (const listing of listings) {
    if (!listing.expiresAt) continue;
    const recent = await prisma.notification.findFirst({
      where: {
        userId: listing.farmerProfile.userId,
        type: 'LISTING_EXPIRING',
        relatedEntityId: listing.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent) continue;

    await notifyFarmerListingExpiring({
      id: listing.id,
      crop: listing.crop,
      farmerUserId: listing.farmerProfile.userId,
      expiresAt: listing.expiresAt,
    });
    sent += 1;
  }

  return sent;
}

export async function runListingMaintenanceJobs(): Promise<void> {
  await processListingExpiryWarnings();
  await expireDueListings();
}
