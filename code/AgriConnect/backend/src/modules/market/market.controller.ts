import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import {
  fetchLiveMandiPrices,
  fetchMandiPriceHistory,
  listMandiCommodities,
  listMandiMarkets,
  listMandiStates,
} from '../../services/mandi-prices.service.js';
import { getPriceTrendSummary, listPriceTrends, compareListingsToMandi } from './market.service.js';
import type { ComparePricesBody } from './compare.schema.js';
import type { MandiCommoditiesQuery, MandiHistoryQuery, MandiPricesQuery } from './mandi.schema.js';
import type { PriceTrendQuery } from './market.schema.js';

function mandiFeedError(cause: unknown): AppError {
  const message =
    cause instanceof Error ? cause.message : 'Could not reach govt mandi price feed';
  return new AppError(502, 'MANDI_FEED_UNAVAILABLE', message);
}

export const listPriceTrendsController = asyncHandler(async (request, response) => {
  sendSuccess(response, await listPriceTrends(request.query as unknown as PriceTrendQuery));
});

export const priceTrendSummaryController = asyncHandler(async (request, response) => {
  sendSuccess(response, await getPriceTrendSummary(request.query as unknown as PriceTrendQuery));
});

export const liveMandiPricesController = asyncHandler(async (request, response) => {
  const query = request.query as unknown as MandiPricesQuery;
  try {
    const result = await fetchLiveMandiPrices({
      state: query.state,
      commodity: query.commodity,
      market: query.market,
      latestOnly: query.latestOnly ?? true,
    });
    sendSuccess(response, result.data, 200, result.meta);
  } catch (error) {
    throw mandiFeedError(error);
  }
});

export const mandiPriceHistoryController = asyncHandler(async (request, response) => {
  const query = request.query as unknown as MandiHistoryQuery;
  try {
    const result = await fetchMandiPriceHistory(query);
    sendSuccess(response, result.data, 200, result.meta);
  } catch (error) {
    throw mandiFeedError(error);
  }
});

export const mandiStatesController = asyncHandler(async (_request, response) => {
  try {
    sendSuccess(response, await listMandiStates());
  } catch (error) {
    throw mandiFeedError(error);
  }
});

export const mandiCommoditiesController = asyncHandler(async (request, response) => {
  const query = request.query as unknown as MandiCommoditiesQuery;
  try {
    const result = await listMandiCommodities(query.state);
    sendSuccess(response, result.data, 200, result.meta);
  } catch (error) {
    throw mandiFeedError(error);
  }
});

export const mandiMarketsController = asyncHandler(async (request, response) => {
  const query = request.query as unknown as { state: string };
  try {
    sendSuccess(response, await listMandiMarkets(query.state));
  } catch (error) {
    throw mandiFeedError(error);
  }
});

export const comparePricesController = asyncHandler(async (request, response) => {
  const body = request.body as ComparePricesBody;
  sendSuccess(response, await compareListingsToMandi(body.items));
});
