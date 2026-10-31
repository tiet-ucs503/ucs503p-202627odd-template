import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import { createAlert, deleteAlert, listMyAlerts } from './alerts.service.js';
import type { BuyerAlertBody } from './alerts.schema.js';

function authenticatedUser(request: Request) {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}

function stringParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${name}`);
  }
  return value;
}

export const listMyAlertsController = asyncHandler(async (request, response) => {
  sendSuccess(response, await listMyAlerts(authenticatedUser(request).id));
});

export const createAlertController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await createAlert(authenticatedUser(request).id, request.body as BuyerAlertBody),
    201,
  );
});

export const deleteAlertController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await deleteAlert(authenticatedUser(request).id, stringParam(request, 'id')),
  );
});
