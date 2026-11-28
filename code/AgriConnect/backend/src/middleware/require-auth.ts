import type { RequestHandler } from 'express';
import { AppError } from '../common/app-error.js';
import { getPrismaClient } from '../config/db.js';
import {
  isAccessTokenExpiredError,
  isAccessTokenInvalidError,
  verifyAccessToken,
} from '../utils/jwt.js';

function extractBearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return token;
}

export const requireAuth: RequestHandler = (request, _response, next) => {
  void (async () => {
    try {
      const payload = verifyAccessToken(
        extractBearerToken(request.header('authorization')),
      );
      const user = await getPrismaClient().user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: { id: true, role: true, isSuspended: true },
      });

      if (!user) {
        throw new AppError(401, 'TOKEN_INVALID', 'Invalid access token');
      }

      request.user = user;
      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      if (isAccessTokenExpiredError(error)) {
        next(new AppError(401, 'TOKEN_EXPIRED', 'Access token expired'));
        return;
      }
      if (isAccessTokenInvalidError(error)) {
        next(new AppError(401, 'TOKEN_INVALID', 'Invalid access token'));
        return;
      }
      next(error);
    }
  })();
};
