import type { RequestHandler } from 'express';
import { AppError } from '../common/app-error.js';

export const requireActiveAccount: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (!request.user) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }

  if (request.user.isSuspended) {
    next(
      new AppError(
        403,
        'ACCOUNT_SUSPENDED',
        'This account has been suspended',
      ),
    );
    return;
  }

  next();
};
