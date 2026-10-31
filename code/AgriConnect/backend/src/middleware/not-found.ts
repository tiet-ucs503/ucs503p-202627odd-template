import type { RequestHandler } from 'express';
import { AppError } from '../common/app-error.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      404,
      'NOT_FOUND',
      `Route ${request.method} ${request.originalUrl} not found`,
    ),
  );
};
