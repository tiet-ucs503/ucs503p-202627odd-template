import type { RequestHandler } from 'express';
import { getPrismaClient } from '../config/db.js';
import {
  isAccessTokenExpiredError,
  isAccessTokenInvalidError,
  verifyAccessToken,
} from '../utils/jwt.js';

export const optionalAuth: RequestHandler = (request, _response, next) => {
  const header = request.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next();
    return;
  }

  void (async () => {
    try {
      const payload = verifyAccessToken(token);
      const user = await getPrismaClient().user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: { id: true, role: true, isSuspended: true },
      });
      if (user) {
        request.user = user;
      }
      next();
    } catch (error) {
      if (isAccessTokenExpiredError(error) || isAccessTokenInvalidError(error)) {
        next();
        return;
      }
      next(error);
    }
  })();
};
