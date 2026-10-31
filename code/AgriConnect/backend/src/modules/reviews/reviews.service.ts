import type { Prisma, Role } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { getPrismaClient } from '../../config/db.js';
import type { CreateReviewInput, ListReviewsQuery } from './reviews.schema.js';

interface AuthenticatedActor {
  id: string;
  role: Role;
}

const reviewInclude = {
  fromUser: { select: { id: true, name: true } },
  toUser: { select: { id: true, name: true } },
} satisfies Prisma.ReviewInclude;

function serializeReview(
  review: Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>,
) {
  return {
    id: review.id,
    orderId: review.orderId,
    fromUserId: review.fromUserId,
    toUserId: review.toUserId,
    rating: review.rating,
    comment: review.comment,
    fromUser: review.fromUser,
    toUser: review.toUser,
    createdAt: review.createdAt.toISOString(),
  };
}

function ratingAvgString(value: number): string {
  return value.toFixed(2);
}

async function getParticipantOrder(actor: AuthenticatedActor, orderId: string) {
  const order = await getPrismaClient().order.findFirst({
    where: {
      id: orderId,
      ...(actor.role === 'BUYER'
        ? { buyerId: actor.id }
        : actor.role === 'FARMER'
          ? { farmerId: actor.id }
          : {}),
    },
    select: {
      id: true,
      buyerId: true,
      farmerId: true,
      status: true,
    },
  });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  return order;
}

async function refreshProfileRating(toUserId: string, transaction: Prisma.TransactionClient) {
  const agg = await transaction.review.aggregate({
    where: { toUserId },
    _avg: { rating: true },
  });
  const avg = agg._avg.rating ?? 0;
  const user = await transaction.user.findUnique({
    where: { id: toUserId },
    select: { role: true },
  });
  if (!user) return;

  const ratingAvg = ratingAvgString(avg);
  if (user.role === 'FARMER') {
    await transaction.farmerProfile.update({
      where: { userId: toUserId },
      data: { ratingAvg },
    });
  } else if (user.role === 'BUYER') {
    await transaction.buyerProfile.update({
      where: { userId: toUserId },
      data: { ratingAvg },
    });
  }
}

export async function createReview(
  actor: AuthenticatedActor,
  orderId: string,
  input: CreateReviewInput,
) {
  const order = await getParticipantOrder(actor, orderId);
  if (order.status !== 'fulfilled') {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Reviews are only allowed after the order is fulfilled',
    );
  }

  const toUserId =
    actor.id === order.buyerId ? order.farmerId : actor.id === order.farmerId ? order.buyerId : null;
  if (!toUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  const existing = await getPrismaClient().review.findUnique({
    where: { orderId_fromUserId: { orderId, fromUserId: actor.id } },
  });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'You already reviewed this order');
  }

  const review = await getPrismaClient().$transaction(async (transaction) => {
    const created = await transaction.review.create({
      data: {
        orderId,
        fromUserId: actor.id,
        toUserId,
        rating: input.rating,
        comment: input.comment ?? null,
      },
      include: reviewInclude,
    });
    await refreshProfileRating(toUserId, transaction);
    return created;
  });

  return serializeReview(review);
}

export async function listOrderReviews(
  actor: AuthenticatedActor,
  orderId: string,
  query: ListReviewsQuery,
) {
  await getParticipantOrder(actor, orderId);

  const skip = (query.page - 1) * query.limit;
  const [reviews, total] = await Promise.all([
    getPrismaClient().review.findMany({
      where: { orderId },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().review.count({ where: { orderId } }),
  ]);

  return {
    reviews: reviews.map(serializeReview),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

export async function listUserReviews(userId: string, query: ListReviewsQuery) {
  const skip = (query.page - 1) * query.limit;
  const [reviews, total] = await Promise.all([
    getPrismaClient().review.findMany({
      where: { toUserId: userId },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    getPrismaClient().review.count({ where: { toUserId: userId } }),
  ]);

  return {
    reviews: reviews.map(serializeReview),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
}

export async function getMyOrderReview(actor: AuthenticatedActor, orderId: string) {
  await getParticipantOrder(actor, orderId);
  const review = await getPrismaClient().review.findUnique({
    where: { orderId_fromUserId: { orderId, fromUserId: actor.id } },
    include: reviewInclude,
  });
  return review ? serializeReview(review) : null;
}
