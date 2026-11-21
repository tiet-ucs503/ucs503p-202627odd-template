import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { moneyString } from '../../common/decimal.js';
import { serializeUser } from '../../common/user-serializers.js';
import { getPrismaClient } from '../../config/db.js';
import { createNotification } from '../../services/notification.service.js';
import { assertListingCanActivate } from '../listings/listing-status.js';
import { serializeListing } from '../listings/listings.serializers.js';
import type {
  ActivityLogsQuery,
  AdminUsersQuery,
  ModerateListingInput,
  SuspendUserInput,
  VerifyUserInput,
} from './admin.schema.js';

async function writeLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Prisma.InputJsonValue = {},
) {
  await getPrismaClient().adminActivityLog.create({
    data: { actorId, action, targetType, targetId, metadata },
  });
}

export async function listUsers(query: AdminUsersQuery) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.suspended === undefined ? {} : { isSuspended: query.suspended }),
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [users, total] = await Promise.all([
    getPrismaClient().user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().user.count({ where }),
  ]);

  return {
    users: users.map(serializeUser),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

export async function suspendUser(
  actorId: string,
  targetId: string,
  input: SuspendUserInput,
) {
  if (actorId === targetId) {
    throw new AppError(403, 'FORBIDDEN', 'Admins cannot suspend themselves');
  }

  const target = await getPrismaClient().user.findFirst({
    where: { id: targetId, deletedAt: null },
  });
  if (!target) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  if (target.role === 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Admins cannot suspend other admins');
  }

  const updated = await getPrismaClient().user.update({
    where: { id: target.id },
    data: { isSuspended: input.isSuspended },
  });

  await writeLog(actorId, input.isSuspended ? 'USER_SUSPEND' : 'USER_UNSUSPEND', 'User', target.id, {
    reason: input.reason ?? null,
  });

  if (input.isSuspended) {
    await createNotification({
      userId: target.id,
      type: 'ACCOUNT_SUSPENDED',
      title: 'Account suspended',
      body: input.reason ?? 'Your AgriConnect account has been suspended.',
      params: input.reason ? { reason: input.reason } : {},
      relatedEntityType: 'User',
      relatedEntityId: target.id,
    });
  }

  return serializeUser(updated);
}

export async function verifyUser(
  actorId: string,
  targetId: string,
  input: VerifyUserInput,
) {
  const target = await getPrismaClient().user.findFirst({
    where: { id: targetId, deletedAt: null },
  });
  if (!target) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const updated = await getPrismaClient().user.update({
    where: { id: target.id },
    data: { verified: input.verified },
  });
  await writeLog(actorId, 'USER_VERIFY', 'User', target.id, {
    verified: input.verified,
  });
  return serializeUser(updated);
}

export async function moderateListing(
  actorId: string,
  listingId: string,
  input: ModerateListingInput,
) {
  const listing = await getPrismaClient().listing.findFirst({
    where: { id: listingId, deletedAt: null },
    include: {
      photos: {
        select: { id: true, publicUrl: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
      farmerProfile: {
        select: {
          id: true,
          farmName: true,
          ratingAvg: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              state: true,
              district: true,
              verified: true,
            },
          },
        },
      },
    },
  });
  if (!listing) {
    throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  }

  if (input.status === 'removed') {
    const updated = await getPrismaClient().listing.update({
      where: { id: listing.id },
      data: { status: 'removed' },
      include: {
        photos: {
          select: { id: true, publicUrl: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        farmerProfile: {
          select: {
            id: true,
            farmName: true,
            ratingAvg: true,
            user: {
              select: {
                id: true,
                name: true,
                state: true,
                district: true,
                verified: true,
              },
            },
          },
        },
      },
    });
    await writeLog(actorId, 'LISTING_REMOVE', 'Listing', listing.id, {
      reason: input.reason ?? null,
    });
    await createNotification({
      userId: listing.farmerProfile.userId,
      type: 'LISTING_MODERATED',
      title: 'Listing removed',
      body: input.reason ?? 'An admin removed your listing.',
      params: { variant: 'removed', ...(input.reason ? { reason: input.reason } : {}) },
      relatedEntityType: 'Listing',
      relatedEntityId: listing.id,
    });
    return serializeListing(updated, { id: actorId, role: 'ADMIN' });
  }

  assertListingCanActivate({
    photoCount: listing.photos.length,
    quantity: listing.quantity.toString(),
    minimumOrderQuantity: listing.minimumOrderQuantity.toString(),
  });

  const updated = await getPrismaClient().listing.update({
    where: { id: listing.id },
    data: { status: 'active', deletedAt: null },
    include: {
      photos: {
        select: { id: true, publicUrl: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
      farmerProfile: {
        select: {
          id: true,
          farmName: true,
          ratingAvg: true,
          user: {
            select: {
              id: true,
              name: true,
              state: true,
              district: true,
              verified: true,
            },
          },
        },
      },
    },
  });
  await writeLog(actorId, 'LISTING_REINSTATE', 'Listing', listing.id, {
    reason: input.reason ?? null,
  });
  await createNotification({
    userId: listing.farmerProfile.userId,
    type: 'LISTING_MODERATED',
    title: 'Listing reinstated',
    body: input.reason ?? 'An admin reinstated your listing.',
    params: { variant: 'reinstated', ...(input.reason ? { reason: input.reason } : {}) },
    relatedEntityType: 'Listing',
    relatedEntityId: listing.id,
  });
  return serializeListing(updated, { id: actorId, role: 'ADMIN' });
}

export async function getAnalytics() {
  const [totalUsers, farmers, buyers, admins, totalListings, activeListings, totalOrders, fulfilled] =
    await getPrismaClient().$transaction([
      getPrismaClient().user.count({ where: { deletedAt: null } }),
      getPrismaClient().user.count({ where: { deletedAt: null, role: 'FARMER' } }),
      getPrismaClient().user.count({ where: { deletedAt: null, role: 'BUYER' } }),
      getPrismaClient().user.count({ where: { deletedAt: null, role: 'ADMIN' } }),
      getPrismaClient().listing.count({ where: { deletedAt: null } }),
      getPrismaClient().listing.count({ where: { deletedAt: null, status: 'active' } }),
      getPrismaClient().order.count(),
      getPrismaClient().order.aggregate({
        where: { status: 'fulfilled' },
        _sum: { priceTotal: true },
      }),
    ]);

  return {
    totalUsers,
    usersByRole: { FARMER: farmers, BUYER: buyers, ADMIN: admins },
    totalListings,
    activeListings,
    totalOrders,
    gmv: moneyString(fulfilled._sum.priceTotal ?? 0),
  };
}

export async function listActivityLogs(query: ActivityLogsQuery) {
  const where: Prisma.AdminActivityLogWhereInput = {
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: query.action } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    getPrismaClient().adminActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().adminActivityLog.count({ where }),
  ]);

  return {
    logs: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}
