import type { ListingStatus, Prisma, Role } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { assertNoContactInfo } from '../../common/contact-guard.js';
import { toDecimal } from '../../common/decimal.js';
import { getPrismaClient } from '../../config/db.js';
import {
  deleteListingPhotos,
  uploadListingPhoto,
} from '../../services/storage.service.js';
import { notifyBuyersOfPublishedListing } from '../../services/listing-notifications.service.js';
import { recordPriceTrend } from '../../services/price-trend.service.js';
import {
  assertFarmerStatusTransition,
  assertListingCanActivate,
} from './listing-status.js';
import { serializeListing, type ListingViewer } from './listings.serializers.js';
import type {
  CreateListingInput,
  ListListingsQuery,
  UpdateListingInput,
} from './listings.schema.js';

const listingInclude = {
  photos: {
    select: { id: true, publicUrl: true, sortOrder: true, storagePath: true },
    orderBy: { sortOrder: 'asc' as const },
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
} satisfies Prisma.ListingInclude;

function defaultExpiresAt(harvestDate: Date): Date {
  const expires = new Date(harvestDate);
  expires.setUTCDate(expires.getUTCDate() + 14);
  expires.setUTCHours(23, 59, 59, 999);
  return expires;
}

function harvestDateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Listing prose is read by every buyer, so it is a broadcast channel for a phone number
 * and gets the same contact scan as chat. Crop, unit, price, and quantity are enumerated
 * or numeric and cannot carry a message.
 */
function assertListingTextIsClean(input: CreateListingInput | UpdateListingInput): void {
  assertNoContactInfo(input.description, 'description');
  assertNoContactInfo(input.variety, 'variety');
  assertNoContactInfo(input.village, 'village');
}

async function requireOwnedListing(listingId: string, farmerUserId: string) {
  const listing = await getPrismaClient().listing.findFirst({
    where: {
      id: listingId,
      deletedAt: null,
      farmerProfile: { userId: farmerUserId },
    },
    include: listingInclude,
  });
  if (!listing) {
    throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  }
  return listing;
}

export async function createListing(farmerUserId: string, input: CreateListingInput) {
  const farmerProfile = await getPrismaClient().farmerProfile.findUnique({
    where: { userId: farmerUserId },
  });
  if (!farmerProfile) {
    throw new AppError(404, 'NOT_FOUND', 'Farmer profile not found');
  }

  if (input.status === 'active') {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Active listings require at least one photo',
    );
  }

  assertListingTextIsClean(input);

  const harvestDate = harvestDateFromInput(input.harvestDate);
  const listing = await getPrismaClient().listing.create({
    data: {
      farmerProfileId: farmerProfile.id,
      crop: input.crop,
      category: input.category,
      variety: input.variety ?? null,
      quantity: toDecimal(input.quantity),
      unit: input.unit,
      pricePerUnit: toDecimal(input.pricePerUnit),
      harvestDate,
      state: input.state,
      district: input.district,
      village: input.village ?? null,
      description: input.description ?? null,
      minimumOrderQuantity: toDecimal(input.minimumOrderQuantity),
      status: 'draft',
      perishable: input.perishable,
      expiresAt: defaultExpiresAt(harvestDate),
    },
    include: listingInclude,
  });

  return serializeListing(listing, { id: farmerUserId, role: 'FARMER' });
}

export async function listListings(query: ListListingsQuery, viewer?: ListingViewer & { role?: Role }) {
  let mineUserId: string | undefined;
  if (query.mine) {
    if (viewer?.role !== 'FARMER' || !viewer.id) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    mineUserId = viewer.id;
  }
  if (
    !query.mine &&
    query.status &&
    query.status !== 'active' &&
    viewer?.role !== 'ADMIN'
  ) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Public discovery only supports active listings',
    );
  }

  const where: Prisma.ListingWhereInput = mineUserId
    ? {
        deletedAt: null,
        farmerProfile: { userId: mineUserId },
        ...(query.status ? { status: query.status } : {}),
      }
    : {
        deletedAt: null,
        status:
          viewer?.role === 'ADMIN' && query.status ? query.status : 'active',
      };

  if (query.crop) where.crop = { contains: query.crop, mode: 'insensitive' };
  if (query.category) where.category = { contains: query.category, mode: 'insensitive' };
  if (query.state) where.state = query.state;
  if (query.district) where.district = query.district;
  if (query.perishable !== undefined) where.perishable = query.perishable;
  if (query.minQuantity) where.quantity = { gte: toDecimal(query.minQuantity) };
  if (query.harvestFrom || query.harvestTo) {
    where.harvestDate = {
      ...(query.harvestFrom ? { gte: harvestDateFromInput(query.harvestFrom) } : {}),
      ...(query.harvestTo ? { lte: harvestDateFromInput(query.harvestTo) } : {}),
    };
  }
  if (query.minPrice || query.maxPrice) {
    where.pricePerUnit = {
      ...(query.minPrice ? { gte: toDecimal(query.minPrice) } : {}),
      ...(query.maxPrice ? { lte: toDecimal(query.maxPrice) } : {}),
    };
  }

  const orderBy: Prisma.ListingOrderByWithRelationInput =
    query.sort === 'price_asc'
      ? { pricePerUnit: 'asc' }
      : query.sort === 'price_desc'
        ? { pricePerUnit: 'desc' }
        : query.sort === 'harvestDate_asc'
          ? { harvestDate: 'asc' }
          : { createdAt: 'desc' };

  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    getPrismaClient().listing.findMany({
      where,
      include: listingInclude,
      orderBy,
      skip,
      take: query.limit,
    }),
    getPrismaClient().listing.count({ where }),
  ]);

  return {
    listings: rows.map((row) => serializeListing(row, viewer)),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

function canViewListing(
  listing: { status: ListingStatus; farmerProfile: { user: { id: string } } },
  viewer?: ListingViewer,
): boolean {
  const isOwner = viewer?.id === listing.farmerProfile.user.id;
  const isAdmin = viewer?.role === 'ADMIN';
  if (isOwner || isAdmin) {
    return true;
  }
  return ['active', 'sold_out', 'expired'].includes(listing.status);
}

export async function getListing(listingId: string, viewer?: ListingViewer) {
  const listing = await getPrismaClient().listing.findFirst({
    where: { id: listingId, deletedAt: null },
    include: listingInclude,
  });
  if (!listing || !canViewListing(listing, viewer)) {
    throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  }

  const isOwner = viewer?.id === listing.farmerProfile.user.id;
  if (!isOwner) {
    await getPrismaClient().listing.update({
      where: { id: listing.id },
      data: { viewCount: { increment: 1 } },
    });
    listing.viewCount += 1;
  }

  let isRelatedBuyer = false;
  if (viewer?.role === 'BUYER' && viewer.id) {
    isRelatedBuyer =
      (await getPrismaClient().order.count({
        where: { listingId, buyerId: viewer.id },
      })) > 0;
  }
  return serializeListing(
    listing,
    viewer,
    isRelatedBuyer ? { includeVillage: true } : {},
  );
}

export async function updateListing(
  farmerUserId: string,
  listingId: string,
  input: UpdateListingInput,
) {
  const listing = await requireOwnedListing(listingId, farmerUserId);
  const nextStatus = input.status ?? listing.status;
  if (input.status) {
    assertFarmerStatusTransition(listing.status, input.status);
  }

  assertListingTextIsClean(input);

  const nextQuantity = input.quantity ? toDecimal(input.quantity) : listing.quantity;
  const nextMoq = input.minimumOrderQuantity
    ? toDecimal(input.minimumOrderQuantity)
    : listing.minimumOrderQuantity;
  const harvestDate = input.harvestDate
    ? harvestDateFromInput(input.harvestDate)
    : listing.harvestDate;

  if (nextStatus === 'active') {
    assertListingCanActivate({
      photoCount: listing.photos.length,
      quantity: nextQuantity.toString(),
      minimumOrderQuantity: nextMoq.toString(),
    });
  }

  const data: Prisma.ListingUncheckedUpdateInput = {
    ...(input.crop !== undefined && { crop: input.crop }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.variety !== undefined && { variety: input.variety }),
    ...(input.quantity !== undefined && { quantity: nextQuantity }),
    ...(input.unit !== undefined && { unit: input.unit }),
    ...(input.pricePerUnit !== undefined && {
      pricePerUnit: toDecimal(input.pricePerUnit),
    }),
    ...(input.harvestDate !== undefined && {
      harvestDate,
      expiresAt: defaultExpiresAt(harvestDate),
    }),
    ...(input.state !== undefined && { state: input.state }),
    ...(input.district !== undefined && { district: input.district }),
    ...(input.village !== undefined && { village: input.village }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.minimumOrderQuantity !== undefined && {
      minimumOrderQuantity: nextMoq,
    }),
    ...(input.status !== undefined && { status: nextStatus }),
    ...(input.perishable !== undefined && { perishable: input.perishable }),
  };
  const updated = await getPrismaClient().listing.update({
    where: { id: listing.id },
    data,
    include: listingInclude,
  });

  if (listing.status !== 'active' && nextStatus === 'active') {
    void recordPriceTrend({
      crop: updated.crop,
      state: updated.state,
      district: updated.district,
      source: 'internal_listing',
      pricePerUnit: updated.pricePerUnit.toString(),
      unit: updated.unit,
    });
    void notifyBuyersOfPublishedListing({
      id: updated.id,
      crop: updated.crop,
      state: updated.state,
      district: updated.district,
      pricePerUnit: updated.pricePerUnit,
      unit: updated.unit,
      farmerName: updated.farmerProfile.user.name,
    });
  }

  return serializeListing(updated, { id: farmerUserId, role: 'FARMER' });
}

export async function deleteListing(farmerUserId: string, listingId: string) {
  const listing = await requireOwnedListing(listingId, farmerUserId);
  await getPrismaClient().listing.update({
    where: { id: listing.id },
    data: { status: 'removed', deletedAt: new Date() },
  });
  return { deleted: true };
}

export async function addListingPhotos(
  farmerUserId: string,
  listingId: string,
  files: Express.Multer.File[],
) {
  const listing = await requireOwnedListing(listingId, farmerUserId);
  if (files.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one photo is required');
  }
  if (listing.photos.length + files.length > 5) {
    throw new AppError(400, 'INVALID_REQUEST', 'A listing may have at most 5 photos');
  }

  const uploaded = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadListingPhoto(listing.id, file));
    }
    await getPrismaClient().listingPhoto.createMany({
      data: uploaded.map((stored, index) => ({
        listingId: listing.id,
        storagePath: stored.storagePath,
        publicUrl: stored.publicUrl,
        sortOrder: listing.photos.length + index,
      })),
    });
  } catch (error) {
    await deleteListingPhotos(uploaded.map((photo) => photo.storagePath)).catch(
      () => undefined,
    );
    throw error;
  }

  const created = await getPrismaClient().listingPhoto.findMany({
    where: {
      listingId: listing.id,
      sortOrder: { gte: listing.photos.length },
    },
    orderBy: { sortOrder: 'asc' },
  });
  return {
    photos: created.map((photo) => ({
      id: photo.id,
      publicUrl: photo.publicUrl,
      sortOrder: photo.sortOrder,
    })),
  };
}

export async function deleteListingPhoto(
  actor: { id: string; role: Role },
  listingId: string,
  photoId: string,
) {
  const listing = await getPrismaClient().listing.findFirst({
    where: {
      id: listingId,
      deletedAt: null,
      ...(actor.role === 'ADMIN' ? {} : { farmerProfile: { userId: actor.id } }),
    },
    include: listingInclude,
  });
  if (!listing) {
    throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  }

  const photo = listing.photos.find((item) => item.id === photoId);
  if (!photo) {
    throw new AppError(404, 'NOT_FOUND', 'Photo not found');
  }

  await deleteListingPhotos([photo.storagePath]);
  await getPrismaClient().$transaction([
    getPrismaClient().listingPhoto.delete({ where: { id: photo.id } }),
    ...(listing.status === 'active' && listing.photos.length === 1
      ? [
          getPrismaClient().listing.update({
            where: { id: listing.id },
            data: { status: 'draft' },
          }),
        ]
      : []),
  ]);

  return { deleted: true };
}

export async function expireDueListings(): Promise<number> {
  const result = await getPrismaClient().listing.updateMany({
    where: {
      status: 'active',
      deletedAt: null,
      expiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  });
  return result.count;
}
