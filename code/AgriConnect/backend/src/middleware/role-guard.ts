import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/client.js';
import { AppError } from '../common/app-error.js';

export function roleGuard(...allowedRoles: Role[]): RequestHandler {
  const allowed = new Set(allowedRoles);

  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (!allowed.has(request.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
      return;
    }

    next();
  };
}
