import { AppError } from '../../common/app-error.js';
import {
  serializeBuyerProfile,
  serializeFarmerProfile,
  serializeMe,
  serializePublicFarmer,
  serializeUser,
} from '../../common/user-serializers.js';
import { getPrismaClient } from '../../config/db.js';
import { restoreListingStock } from '../orders/inventory.js';
import type {
  UpdateBuyerProfileInput,
  UpdateFarmerProfileInput,
  UpdateMeInput,
} from './users.schema.js';

const userWithProfiles = {
  farmerProfile: true,
  buyerProfile: true,
} as const;

export async function updateMe(userId: string, input: UpdateMeInput) {
  const user = await getPrismaClient().user.update({
    where: { id: userId },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.languagePref === undefined
        ? {}
        : { languagePref: input.languagePref }),
      ...(input.state === undefined ? {} : { state: input.state }),
      ...(input.district === undefined ? {} : { district: input.district }),
      ...(input.village === undefined ? {} : { village: input.village }),
    },
  });
  return serializeUser(user);
}

export async function getFarmerProfile(userId: string) {
  const profile = await getPrismaClient().farmerProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Farmer profile not found');
  }
  return serializeFarmerProfile(profile);
}

export async function updateFarmerProfile(
  userId: string,
  input: UpdateFarmerProfileInput,
) {
  const profile = await getPrismaClient().farmerProfile.update({
    where: { userId },
    data: {
      ...(input.farmName === undefined ? {} : { farmName: input.farmName }),
      ...(input.region === undefined ? {} : { region: input.region }),
    },
  });
  return serializeFarmerProfile(profile);
}

export async function getBuyerProfile(userId: string) {
  const profile = await getPrismaClient().buyerProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Buyer profile not found');
  }
  return serializeBuyerProfile(profile);
}

export async function updateBuyerProfile(
  userId: string,
  input: UpdateBuyerProfileInput,
) {
  const profile = await getPrismaClient().buyerProfile.update({
    where: { userId },
    data: {
      ...(input.businessName === undefined
        ? {}
        : { businessName: input.businessName }),
      ...(input.buyerType === undefined
        ? {}
        : { buyerType: input.buyerType }),
    },
  });
  return serializeBuyerProfile(profile);
}

export async function getPublicFarmer(userId: string) {
  const user = await getPrismaClient().user.findFirst({
    where: {
      id: userId,
      role: 'FARMER',
      deletedAt: null,
    },
    include: {
      farmerProfile: {
        select: { farmName: true, ratingAvg: true },
      },
    },
  });
  if (!user?.farmerProfile) {
    throw new AppError(404, 'NOT_FOUND', 'Farmer not found');
  }
  return serializePublicFarmer(user);
}

export async function exportMe(userId: string) {
  const user = await getPrismaClient().user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      farmerProfile: {
        include: {
          listings: {
            include: { photos: true },
          },
        },
      },
      buyerProfile: true,
      buyerOrders: true,
      farmerOrders: true,
      notifications: true,
    },
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  return {
    user: serializeUser(user),
    farmerProfile: serializeFarmerProfile(user.farmerProfile),
    buyerProfile: serializeBuyerProfile(user.buyerProfile),
    listings: user.farmerProfile?.listings ?? [],
    orders: [...user.buyerOrders, ...user.farmerOrders],
    notifications: user.notifications,
  };
}

export async function deleteMe(
  userId: string,
  role: 'FARMER' | 'BUYER' | 'ADMIN' | 'AGRONOMIST',
) {
  if (role === 'ADMIN' || role === 'AGRONOMIST') {
    throw new AppError(403, 'FORBIDDEN', 'Admin and agronomist accounts cannot self-delete');
  }

  await getPrismaClient().$transaction(async (transaction) => {
    const pendingOrders = await transaction.order.findMany({
      where: {
        OR: [{ buyerId: userId }, { farmerId: userId }],
        status: { in: ['pending', 'accepted', 'confirmed'] },
      },
    });

    for (const order of pendingOrders) {
      await restoreListingStock(transaction, order.listingId, order.quantity);
      await transaction.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          cancellationReason: 'Account deleted',
        },
      });
    }

    await transaction.listing.updateMany({
      where: {
        farmerProfile: { userId },
        deletedAt: null,
      },
      data: {
        status: 'removed',
        deletedAt: new Date(),
      },
    });

    await transaction.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await transaction.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `deleted+${userId}@invalid.local`,
        isSuspended: true,
      },
    });
  });

  return { deleted: true };
}

export async function getMe(userId: string) {
  const user = await getPrismaClient().user.findFirst({
    where: { id: userId, deletedAt: null },
    include: userWithProfiles,
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  return serializeMe(user);
}
