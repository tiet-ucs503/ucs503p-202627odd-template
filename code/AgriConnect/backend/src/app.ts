import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { asyncHandler } from './common/async-handler.js';
import { sendError, sendSuccess } from './common/response.js';
import { isDatabaseReady } from './config/db.js';
import { getEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { apiV1Router } from './routes/v1.js';

export function createApp(): express.Express {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('etag', false);
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());

  app.get('/health', (_request, response) => {
    sendSuccess(response, { status: 'ok' });
  });

  app.get(
    '/ready',
    asyncHandler(async (_request, response) => {
      if (!(await isDatabaseReady())) {
        sendError(response, 503, 'NOT_READY', 'Database unavailable');
        return;
      }
      sendSuccess(response, { status: 'ready', database: 'up' });
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );
  app.use(cookieParser());
  // Razorpay signs the exact bytes it sends, so the webhook must reach the handler
  // unparsed. This has to sit above express.json to win the route.
  app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json', limit: '64kb' }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(pinoHttp({ logger }));

  const skipInTests = () => env.NODE_ENV === 'test';

  const globalApiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: skipInTests,
    handler: (_request, response) => {
      sendError(
        response,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many requests',
      );
    },
  });

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: skipInTests,
    handler: (_request, response) => {
      sendError(
        response,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many authentication attempts',
      );
    },
  });

  // A single Kisan turn costs /status + /query + /speak, so the budget covers ~20 questions.
  const assistantLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: skipInTests,
    handler: (_request, response) => {
      sendError(
        response,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many assistant questions. Try again in a minute.',
      );
    },
  });

  app.use('/api', globalApiLimiter);
  app.use('/api/v1/auth', authLimiter);
  app.use('/api/v1/assistant', assistantLimiter);
  app.use('/api/v1', apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
