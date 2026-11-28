import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import type { CreateReviewInput, ListReviewsQuery } from './reviews.schema.js';
import {
  createReview,
  getMyOrderReview,
  listOrderReviews,
  listUserReviews,
} from './reviews.service.js';

function authenticated(request: Request) {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}

function orderId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'Order id is required');
  }
  return id;
}

function userId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'User id is required');
  }
  return id;
}

export const createReviewController = asyncHandler(async (request, response) => {
  const review = await createReview(
    authenticated(request),
    orderId(request),
    request.body as CreateReviewInput,
  );
  sendSuccess(response, review, 201);
});

export const listOrderReviewsController = asyncHandler(async (request, response) => {
  const result = await listOrderReviews(
    authenticated(request),
    orderId(request),
    request.query as unknown as ListReviewsQuery,
  );
  sendPaginated(response, result.reviews, result.pagination);
});

export const getMyOrderReviewController = asyncHandler(async (request, response) => {
  const review = await getMyOrderReview(authenticated(request), orderId(request));
  sendSuccess(response, review);
});

export const listUserReviewsController = asyncHandler(async (request, response) => {
  const result = await listUserReviews(
    userId(request),
    request.query as unknown as ListReviewsQuery,
  );
  sendPaginated(response, result.reviews, result.pagination);
});
