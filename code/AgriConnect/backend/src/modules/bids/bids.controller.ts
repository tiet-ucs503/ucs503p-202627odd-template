import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import type {
  CounterBidInput,
  CreateBidInput,
  ListBidsQuery,
  RejectBidInput,
} from './bids.schema.js';
import {
  acceptBid,
  counterBid,
  createBid,
  getListingBids,
  listBuyerBids,
  listFarmerBids,
  rejectBid,
  withdrawBid,
} from './bids.service.js';

function authenticated(request: Request) {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}

function bidId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'Bid id is required');
  }
  return id;
}

export const createBidController = asyncHandler(async (request, response) => {
  const bid = await createBid(authenticated(request).id, request.body as CreateBidInput);
  sendSuccess(response, bid, 201);
});

export const getListingBidsController = asyncHandler(async (request, response) => {
  const listingId = request.params.listingId;
  if (typeof listingId !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'Listing id is required');
  }
  const bids = await getListingBids(listingId, authenticated(request));
  sendSuccess(response, bids);
});

export const listMyBidsController = asyncHandler(async (request, response) => {
  const result = await listBuyerBids(
    authenticated(request).id,
    request.query as unknown as ListBidsQuery,
  );
  sendPaginated(response, result.bids, result.pagination);
});

export const listIncomingBidsController = asyncHandler(async (request, response) => {
  const result = await listFarmerBids(
    authenticated(request).id,
    request.query as unknown as ListBidsQuery,
  );
  sendPaginated(response, result.bids, result.pagination);
});

export const acceptBidController = asyncHandler(async (request, response) => {
  const result = await acceptBid(authenticated(request), bidId(request));
  sendSuccess(response, result);
});

export const rejectBidController = asyncHandler(async (request, response) => {
  const bid = await rejectBid(
    authenticated(request).id,
    bidId(request),
    request.body as RejectBidInput,
  );
  sendSuccess(response, bid);
});

export const counterBidController = asyncHandler(async (request, response) => {
  const bid = await counterBid(
    authenticated(request).id,
    bidId(request),
    request.body as CounterBidInput,
  );
  sendSuccess(response, bid);
});

export const withdrawBidController = asyncHandler(async (request, response) => {
  const bid = await withdrawBid(authenticated(request).id, bidId(request));
  sendSuccess(response, bid);
});
