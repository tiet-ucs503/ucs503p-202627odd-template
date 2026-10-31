import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import {
  deleteMe,
  exportMe,
  getBuyerProfile,
  getFarmerProfile,
  getMe,
  getPublicFarmer,
  updateBuyerProfile,
  updateFarmerProfile,
  updateMe,
} from './users.service.js';
import type {
  DeleteMeInput,
  UpdateBuyerProfileInput,
  UpdateFarmerProfileInput,
  UpdateMeInput,
} from './users.schema.js';

function authenticatedUser(request: Request) {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}

export const getMeController = asyncHandler(async (request, response) => {
  sendSuccess(response, await getMe(authenticatedUser(request).id));
});

export const updateMeController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await updateMe(authenticatedUser(request).id, request.body as UpdateMeInput),
  );
});

export const getFarmerProfileController = asyncHandler(async (request, response) => {
  sendSuccess(response, await getFarmerProfile(authenticatedUser(request).id));
});

export const updateFarmerProfileController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await updateFarmerProfile(
      authenticatedUser(request).id,
      request.body as UpdateFarmerProfileInput,
    ),
  );
});

export const getBuyerProfileController = asyncHandler(async (request, response) => {
  sendSuccess(response, await getBuyerProfile(authenticatedUser(request).id));
});

export const updateBuyerProfileController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await updateBuyerProfile(
      authenticatedUser(request).id,
      request.body as UpdateBuyerProfileInput,
    ),
  );
});

export const exportMeController = asyncHandler(async (request, response) => {
  sendSuccess(response, await exportMe(authenticatedUser(request).id));
});

export const deleteMeController = asyncHandler(async (request, response) => {
  const user = authenticatedUser(request);
  const input = request.body as DeleteMeInput;
  if (input.confirm !== 'DELETE') {
    throw new AppError(
      400,
      'CONFIRM_TEXT_MISMATCH',
      'Confirmation text must be DELETE',
    );
  }
  sendSuccess(response, await deleteMe(user.id, user.role));
});

export const getPublicFarmerController = asyncHandler(async (request, response) => {
  const id = request.params.id;
  if (typeof id !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid user id');
  }
  sendSuccess(response, await getPublicFarmer(id));
});
