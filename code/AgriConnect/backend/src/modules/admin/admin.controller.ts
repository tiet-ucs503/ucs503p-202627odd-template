import type { Request, RequestHandler } from 'express';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import type {
  ActivityLogsQuery,
  AdminUsersQuery,
  ModerateListingInput,
  SuspendUserInput,
  VerifyUserInput,
} from './admin.schema.js';
import {
  getAnalytics,
  listActivityLogs,
  listUsers,
  moderateListing,
  suspendUser,
  verifyUser,
} from './admin.service.js';

function context(request: Request): { actorId: string; targetId: string } {
  const targetId = request.params.id;
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  if (typeof targetId !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'Target id is required');
  }
  return { actorId: request.user.id, targetId };
}

export const listUsersController: RequestHandler = async (request, response) => {
  const result = await listUsers(request.query as unknown as AdminUsersQuery);
  sendPaginated(response, result.users, result.pagination);
};

export const suspendUserController: RequestHandler = async (request, response) => {
  const { actorId, targetId } = context(request);
  sendSuccess(
    response,
    await suspendUser(actorId, targetId, request.body as SuspendUserInput),
  );
};

export const verifyUserController: RequestHandler = async (request, response) => {
  const { actorId, targetId } = context(request);
  sendSuccess(
    response,
    await verifyUser(actorId, targetId, request.body as VerifyUserInput),
  );
};

export const moderateListingController: RequestHandler = async (
  request,
  response,
) => {
  const { actorId, targetId } = context(request);
  sendSuccess(
    response,
    await moderateListing(actorId, targetId, request.body as ModerateListingInput),
  );
};

export const analyticsController: RequestHandler = async (_request, response) => {
  sendSuccess(response, await getAnalytics());
};

export const activityLogsController: RequestHandler = async (request, response) => {
  const result = await listActivityLogs(
    request.query as unknown as ActivityLogsQuery,
  );
  sendPaginated(response, result.logs, result.pagination);
};
