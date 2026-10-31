import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import {
  comparePricesController,
  liveMandiPricesController,
  listPriceTrendsController,
  mandiCommoditiesController,
  mandiMarketsController,
  mandiPriceHistoryController,
  mandiStatesController,
  priceTrendSummaryController,
} from './market.controller.js';
import {
  mandiCommoditiesQuerySchema,
  mandiHistoryQuerySchema,
  mandiPricesQuerySchema,
  mandiStateQuerySchema,
} from './mandi.schema.js';
import { priceTrendQuerySchema } from './market.schema.js';
import { comparePricesBodySchema } from './compare.schema.js';

export const marketRouter = Router();

marketRouter.get(
  '/prices',
  validate({ query: priceTrendQuerySchema }),
  listPriceTrendsController,
);

marketRouter.get(
  '/prices/summary',
  validate({ query: priceTrendQuerySchema }),
  priceTrendSummaryController,
);

marketRouter.post(
  '/prices/compare',
  validate({ body: comparePricesBodySchema }),
  comparePricesController,
);

marketRouter.get('/mandi/states', mandiStatesController);

marketRouter.get(
  '/mandi/commodities',
  validate({ query: mandiCommoditiesQuerySchema }),
  mandiCommoditiesController,
);

marketRouter.get(
  '/mandi/markets',
  validate({ query: mandiStateQuerySchema }),
  mandiMarketsController,
);

marketRouter.get(
  '/mandi/prices',
  validate({ query: mandiPricesQuerySchema }),
  liveMandiPricesController,
);

marketRouter.get(
  '/mandi/history',
  validate({ query: mandiHistoryQuerySchema }),
  mandiPriceHistoryController,
);