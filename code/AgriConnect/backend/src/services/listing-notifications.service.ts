import { getPrismaClient } from '../config/db.js';
import { createNotifications } from './notification.service.js';
import { sendUserNotificationEmail } from './email.service.js';

const NOTIFY_CAP = 100;

/**
 * Notify buyers who opted into crop/state alerts when a listing is published.
 */
export async function notifyBuyersOfPublishedListing(listing: {
  id: string;
  crop: string;
  state: string;
  district: string;
  pricePerUnit: { toString(): string };
  unit: string;
  farmerName: string;
}): Promise<number> {
  const prisma = getPrismaClient();

  const alertUsers = await prisma.buyerCropAlert.findMany({
    where: {
      enabled: true,
      user: {
        role: 'BUYER',
        deletedAt: null,
        isSuspended: false,
      },
      OR: [
        { crop: listing.crop, state: listing.state },
        { crop: listing.crop, state: null },
        { crop: null, state: listing.state },
        { crop: null, state: null },
      ],
    },
    select: { userId: true },
    take: NOTIFY_CAP,
  });

  const alertUserIds = new Set(alertUsers.map((row) => row.userId));

  // Also notify buyers in the same state who have not set alerts yet (V2 default reach).
  if (alertUserIds.size < NOTIFY_CAP) {
    const regionalWhere = {
      role: 'BUYER' as const,
      deletedAt: null,
      isSuspended: false,
      state: listing.state,
      ...(alertUserIds.size > 0 ? { id: { notIn: [...alertUserIds] } } : {}),
    };
    const regionalBuyers = await prisma.user.findMany({
      where: regionalWhere,
      select: { id: true },
      take: NOTIFY_CAP - alertUserIds.size,
    });
    for (const buyer of regionalBuyers) {
      alertUserIds.add(buyer.id);
    }
  }

  if (alertUserIds.size === 0) return 0;

  const title = `New ${listing.crop} in ${listing.district}`;
  const body = `${listing.farmerName} listed ${listing.crop} at ₹${listing.pricePerUnit.toString()}/${listing.unit} in ${listing.district}, ${listing.state}.`;

  const inputs = [...alertUserIds].map((userId) => ({
    userId,
    type: 'LISTING_PUBLISHED' as const,
    title,
    body,
    params: {
      crop: listing.crop,
      district: listing.district,
      state: listing.state,
      price: listing.pricePerUnit.toString(),
      unit: listing.unit,
      farmer: listing.farmerName,
    },
    relatedEntityType: 'Listing',
    relatedEntityId: listing.id,
  }));

  await createNotifications(inputs);

  for (const input of inputs.slice(0, 20)) {
    void sendUserNotificationEmail(input.userId, input.title, input.body);
  }

  return inputs.length;
}

export async function notifyFarmerListingExpiring(listing: {
  id: string;
  crop: string;
  farmerUserId: string;
  expiresAt: Date;
}): Promise<void> {
  const daysLeft = Math.ceil(
    (listing.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  const title = 'Listing expiring soon';
  const body = `Your ${listing.crop} listing expires in ${String(daysLeft)} day(s). Renew or update quantity if still available.`;

  const { createNotification } = await import('./notification.service.js');
  await createNotification({
    userId: listing.farmerUserId,
    type: 'LISTING_EXPIRING',
    title,
    body,
    params: { crop: listing.crop, days: daysLeft },
    relatedEntityType: 'Listing',
    relatedEntityId: listing.id,
  });
  void sendUserNotificationEmail(listing.farmerUserId, title, body);
}
