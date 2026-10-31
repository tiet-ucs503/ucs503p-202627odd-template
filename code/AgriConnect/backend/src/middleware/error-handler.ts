import type { ErrorRequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../common/app-error.js';
import { sendError } from '../common/response.js';
import { getEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

function fromPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): AppError {
  if (error.code === 'P2002') {
    return new AppError(409, 'CONFLICT', 'Resource already exists', {
      cause: error,
    });
  }
  if (error.code === 'P2025') {
    return new AppError(404, 'NOT_FOUND', 'Resource not found', {
      cause: error,
    });
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Internal server error', {
    cause: error,
    isOperational: false,
  });
}

/**
 * body-parser rejects a request before any route runs and throws an `http-errors`
 * object, not an `AppError`. Without this the documented 413 for an oversized body
 * surfaces as a 500.
 */
function fromBodyParserError(error: unknown): AppError | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { type?: unknown; status?: unknown; statusCode?: unknown };
  if (typeof candidate.type !== 'string') return null;

  const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
  if (typeof status !== 'number' || status >= 500) return null;

  switch (candidate.type) {
    case 'entity.too.large':
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large', {
        cause: error,
      });
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported body encoding', {
        cause: error,
      });
    case 'entity.parse.failed':
      return new AppError(400, 'INVALID_REQUEST', 'Malformed JSON body', { cause: error });
    case 'entity.verify.failed':
    case 'request.aborted':
    case 'request.size.invalid':
    case 'parameters.too.many':
    case 'stream.encoding.set':
    case 'stream.not.readable':
      return new AppError(400, 'INVALID_REQUEST', 'Request body could not be read', {
        cause: error,
      });
    // Anything else keeps its own handling — this must not become a catch-all for
    // unrelated errors that happen to carry a `type` and a 4xx `status`.
    default:
      return null;
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  let appError: AppError;
  const bodyParserError = fromBodyParserError(error);

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    appError = fromPrismaError(error);
  } else if (bodyParserError) {
    appError = bodyParserError;
  } else if (
    error instanceof SyntaxError &&
    'body' in error &&
    error.body !== undefined
  ) {
    appError = new AppError(400, 'INVALID_REQUEST', 'Malformed JSON body');
  } else {
    appError = new AppError(500, 'INTERNAL_ERROR', 'Internal server error', {
      cause: error,
      isOperational: false,
    });
  }

  const logContext = {
    err: error,
    code: appError.code,
    method: request.method,
    path: request.originalUrl,
    userId: request.user?.id,
  };

  if (appError.statusCode >= 500) {
    logger.error(logContext, 'Request failed');
  } else {
    logger.warn(logContext, 'Request rejected');
  }

  const message =
    getEnv().NODE_ENV === 'production' && !appError.isOperational
      ? 'Internal server error'
      : appError.message;

  sendError(
    response,
    appError.statusCode,
    appError.code,
    message,
    appError.fields,
  );
};
