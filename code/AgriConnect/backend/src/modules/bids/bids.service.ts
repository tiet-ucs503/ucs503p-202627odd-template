import type { Prisma, Role } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { moneyString, quantityString, roundMoney, toDecimal } from '../../common/decimal.js';
import { assertNoContactInfo } from '../../common/contact-guard.js';
import { getPrismaClient } from '../../config/db.js';
import { createNotification } from '../../services/notification.service.js';
import { createOrderFromBid } from '../orders/orders.service.js';
import type {
  CounterBidInput,
  CreateBidInput,
  ListBidsQuery,
  RejectBidInput,
} from './bids.schema.js';

const bidInclude = {
  listing: {
    select: {
      id: true,
      crop: true,
      variety: true,
      unit: true,
      pricePerUnit: true,
      quantity: true,
      minimumOrderQuantity: true,
      status: true,
      state: true,
      district: true,
      photos: {
        select: { id: true, publicUrl: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  buyer: {
    select: {
      id: true,
      name: true,
      buyerProfile: { select: { businessName: true, ratingAvg: true } },
    },
  },
  farmer: {
    select: {
      id: true,
      name: true,
      farmerProfile: { select: { farmName: true, ratingAvg: true } },
    },
  },
} satisfies Prisma.BidInclude;

function serializeBid(bid: Prisma.BidGetPayload<{ include: typeof bidInclude }>) {
  return {
    id: bid.id,
    listingId: bid.listingId,
    buyerId: bid.buyerId,
    farmerId: bid.farmerId,
    pricePerUnit: moneyString(bid.pricePerUnit),
    quantity: quantityString(bid.quantity),
    unit: bid.unit,
    priceTotal: moneyString(bid.priceTotal),
    status: bid.status,
    counterPrice: bid.counterPrice ? moneyString(bid.counterPrice) : null,
    notes: bid.notes,
    rejectionReason: bid.rejectionReason,
    orderId: bid.orderId,
    createdAt: bid.createdAt.toISOString(),
    updatedAt: bid.updatedAt.toISOString(),
    listing: {
      id: bid.listing.id,
      crop: bid.listing.crop,
      variety: bid.listing.variety,
      unit: bid.listing.unit,
      pricePerUnit: moneyString(bid.listing.pricePerUnit),
      quantity: quantityString(bid.listing.quantity),
      minimumOrderQuantity: quantityString(bid.listing.minimumOrderQuantity),
      status: bid.listing.status,
      state: bid.listing.state,
      district: bid.listing.district,
      photo: bid.listing.photos[0]?.publicUrl ?? null,
    },
    buyer: {
      id: bid.buyer.id,
      name: bid.buyer.name,
      businessName: bid.buyer.buyerProfile?.businessName ?? null,
      ratingAvg: bid.buyer.buyerProfile?.ratingAvg
        ? Number(bid.buyer.buyerProfile.ratingAvg)
        : null,
    },
    farmer: {
      id: bid.farmer.id,
      name: bid.farmer.name,
      farmName: bid.farmer.farmerProfile?.farmName ?? null,
      ratingAvg: bid.farmer.farmerProfile?.ratingAvg
        ? Number(bid.farmer.farmerProfile.ratingAvg)
        : null,
    },
  };
}

export async function createBid(buyerId: string, input: CreateBidInput) {
  const quantity = toDecimal(input.quantity);
  const pricePerUnit = toDecimal(input.pricePerUnit);

  if (quantity.lessThanOrEqualTo(0) || pricePerUnit.lessThanOrEqualTo(0)) {
    throw new AppError(400, 'INVALID_REQUEST', 'Quantity and price must be greater than zero');
  }

  assertNoContactInfo(input.notes, 'notes');

  const listing = await getPrismaClient().listing.findFirst({
    where: { id: input.listingId, status: 'active', deletedAt: null },
    include: { farmerProfile: { select: { userId: true } } },
  });

  if (!listing) {
    throw new AppError(404, 'NOT_FOUND', 'Listing not found or not active');
  }

  if (listing.farmerProfile.userId === buyerId) {
    throw new AppError(400, 'INVALID_REQUEST', 'Cannot bid on your own listing');
  }

  if (quantity.lessThan(listing.minimumOrderQuantity)) {
    throw new AppError(400, 'INVALID_REQUEST', 'Quantity is below the minimum order quantity');
  }

  if (quantity.greaterThan(listing.quantity)) {
    throw new AppError(400, 'INVALID_REQUEST', 'Quantity exceeds available listing stock');
  }

  const priceTotal = roundMoney(quantity.mul(pricePerUnit));
  const farmerId = listing.farmerProfile.userId;

  const bid = await getPrismaClient().bid.create({
    data: {
      listingId: listing.id,
      buyerId,
      farmerId,
      pricePerUnit,
      quantity,
      unit: listing.unit,
      priceTotal,
      status: 'pending',
      notes: input.notes ?? null,
    },
    include: bidInclude,
  });

  await createNotification({
    userId: farmerId,
    type: 'BID_RECEIVED',
    title: 'New Bid Received',
    body: `A buyer offered ₹${moneyString(pricePerUnit)}/${listing.unit} for ${quantityString(quantity)} ${listing.unit} of ${listing.crop}.`,
    params: {
      crop: listing.crop,
      price: moneyString(pricePerUnit),
      qty: quantityString(quantity),
      unit: listing.unit,
    },
    relatedEntityType: 'Listing',
    relatedEntityId: listing.id,
  });

  return serializeBid(bid);
}

export async function getListingBids(
  listingId: string,
  actor: { id: string; role: Role },
) {
  const listing = await getPrismaClient().listing.findUnique({
    where: { id: listingId },
    include: { farmerProfile: { select: { userId: true } } },
  });

  if (!listing) {
    throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  }

  const isOwner = listing.farmerProfile.userId === actor.id;
  const isAdmin = actor.role === 'ADMIN';

  const where: Prisma.BidWhereInput = {
    listingId,
    ...(isOwner || isAdmin ? {} : { buyerId: actor.id }),
  };

  const bids = await getPrismaClient().bid.findMany({
    where,
    include: bidInclude,
    orderBy: { createdAt: 'desc' },
  });

  return bids.map(serializeBid);
}

export async function listBuyerBids(buyerId: string, query: ListBidsQuery) {
  const where: Prisma.BidWhereInput = {
    buyerId,
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    getPrismaClient().bid.findMany({
      where,
      include: bidInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().bid.count({ where }),
  ]);

  return {
    bids: rows.map(serializeBid),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

export async function listFarmerBids(farmerId: string, query: ListBidsQuery) {
  const where: Prisma.BidWhereInput = {
    farmerId,
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    getPrismaClient().bid.findMany({
      where,
      include: bidInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().bid.count({ where }),
  ]);

  return {
    bids: rows.map(serializeBid),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

export async function acceptBid(
  actor: string | { id: string; role?: Role },
  bidId: string,
) {
  const actorId = typeof actor === 'string' ? actor : actor.id;
  const actorRole = typeof actor === 'string' ? undefined : actor.role;

  const bid = await getPrismaClient().bid.findUnique({
    where: { id: bidId },
    include: { listing: true },
  });

  if (!bid) {
    throw new AppError(404, 'NOT_FOUND', 'Bid not found');
  }

  if (bid.status === 'pending') {
    if (bid.farmerId !== actorId && actorRole !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Only the listing farmer can accept a pending bid');
    }
  } else if (bid.status === 'countered') {
    if (bid.buyerId !== actorId && bid.farmerId !== actorId && actorRole !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Only the buyer can accept this counter-offer');
    }
  } else {
    throw new AppError(400, 'INVALID_REQUEST', `Cannot accept bid with status ${bid.status}`);
  }

  const pricePerUnit = bid.counterPrice ?? bid.pricePerUnit;

  const order = await createOrderFromBid({
    listingId: bid.listingId,
    buyerId: bid.buyerId,
    farmerId: bid.farmerId,
    quantity: quantityString(bid.quantity),
    pricePerUnit: moneyString(pricePerUnit),
    deliveryMode: 'pickup',
    notes: bid.notes,
  });

  const updatedBid = await getPrismaClient().bid.update({
    where: { id: bid.id },
    data: {
      status: 'accepted',
      orderId: order.id,
    },
    include: bidInclude,
  });

  // Notify the other party
  const isFarmerAction = actorId === bid.farmerId;
  const notifyUserId = isFarmerAction ? bid.buyerId : bid.farmerId;
  const notifyBody = isFarmerAction
    ? `The farmer accepted your bid of ₹${moneyString(pricePerUnit)}/${bid.unit} for ${bid.listing.crop}. Order created!`
    : `The buyer accepted your counter-offer of ₹${moneyString(pricePerUnit)}/${bid.unit} for ${bid.listing.crop}. Order created!`;

  await createNotification({
    userId: notifyUserId,
    type: 'BID_ACCEPTED',
    title: 'Bid Accepted!',
    body: notifyBody,
    params: {
      crop: bid.listing.crop,
      price: moneyString(pricePerUnit),
      unit: bid.unit,
      orderId: order.id,
    },
    relatedEntityType: 'Order',
    relatedEntityId: order.id,
  });

  return {
    bid: serializeBid(updatedBid),
    order,
  };
}

export async function rejectBid(farmerId: string, bidId: string, input?: RejectBidInput) {
  const bid = await getPrismaClient().bid.findUnique({
    where: { id: bidId },
    include: { listing: true },
  });

  if (!bid) {
    throw new AppError(404, 'NOT_FOUND', 'Bid not found');
  }

  if (bid.farmerId !== farmerId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own the listing for this bid');
  }

  if (bid.status !== 'pending') {
    throw new AppError(400, 'INVALID_REQUEST', `Cannot reject bid with status ${bid.status}`);
  }

  const updatedBid = await getPrismaClient().bid.update({
    where: { id: bid.id },
    data: {
      status: 'rejected',
      rejectionReason: input?.rejectionReason ?? null,
    },
    include: bidInclude,
  });

  await createNotification({
    userId: bid.buyerId,
    type: 'BID_REJECTED',
    title: 'Bid Declined',
    body: `Your bid of ₹${moneyString(bid.pricePerUnit)}/${bid.unit} on ${bid.listing.crop} was declined.`,
    params: {
      crop: bid.listing.crop,
      price: moneyString(bid.pricePerUnit),
      unit: bid.unit,
    },
    relatedEntityType: 'Listing',
    relatedEntityId: bid.listingId,
  });

  return serializeBid(updatedBid);
}

export async function counterBid(farmerId: string, bidId: string, input: CounterBidInput) {
  const bid = await getPrismaClient().bid.findUnique({
    where: { id: bidId },
    include: { listing: true },
  });

  if (!bid) {
    throw new AppError(404, 'NOT_FOUND', 'Bid not found');
  }

  if (bid.farmerId !== farmerId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own the listing for this bid');
  }

  if (bid.status !== 'pending') {
    throw new AppError(400, 'INVALID_REQUEST', `Cannot counter bid with status ${bid.status}`);
  }

  assertNoContactInfo(input.notes, 'notes');
  const counterPrice = toDecimal(input.counterPrice);

  const updatedBid = await getPrismaClient().bid.update({
    where: { id: bid.id },
    data: {
      status: 'countered',
      counterPrice,
      notes: input.notes ? `${bid.notes ? `${bid.notes} | ` : ''}Farmer counter: ${input.notes}` : bid.notes,
    },
    include: bidInclude,
  });

  await createNotification({
    userId: bid.buyerId,
    type: 'BID_COUNTERED',
    title: 'Counter-Offer Received',
    body: `The farmer countered your bid on ${bid.listing.crop} with ₹${moneyString(counterPrice)}/${bid.unit}.`,
    params: {
      crop: bid.listing.crop,
      counterPrice: moneyString(counterPrice),
      unit: bid.unit,
    },
    relatedEntityType: 'Listing',
    relatedEntityId: bid.listingId,
  });

  return serializeBid(updatedBid);
}

export async function withdrawBid(buyerId: string, bidId: string) {
  const bid = await getPrismaClient().bid.findUnique({
    where: { id: bidId },
  });

  if (!bid) {
    throw new AppError(404, 'NOT_FOUND', 'Bid not found');
  }

  if (bid.buyerId !== buyerId) {
    throw new AppError(403, 'FORBIDDEN', 'You did not place this bid');
  }

  if (bid.status !== 'pending' && bid.status !== 'countered') {
    throw new AppError(400, 'INVALID_REQUEST', `Cannot withdraw bid with status ${bid.status}`);
  }

  const updatedBid = await getPrismaClient().bid.update({
    where: { id: bid.id },
    data: { status: 'withdrawn' },
    include: bidInclude,
  });

  return serializeBid(updatedBid);
}
