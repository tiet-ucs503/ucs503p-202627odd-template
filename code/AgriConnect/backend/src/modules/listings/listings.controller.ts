import type { Request, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import {
  addListingPhotos,
  createListing,
  deleteListing,
  deleteListingPhoto,
  getListing,
  listListings,
  updateListing,
} from './listings.service.js';
import type {
  CreateListingInput,
  ListListingsQuery,
  UpdateListingInput,
} from './listings.schema.js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fields: 0,
    parts: 5,
    fieldNestingDepth: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname !== 'files' && file.fieldname !== 'files[]') {
      callback(new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, and WebP are allowed'),
      );
      return;
    }
    callback(null, true);
  },
});

export const listingPhotoUpload: RequestHandler = (request, response, next) => {
  photoUpload.any()(request, response, (error: unknown) => {
    if (!(error instanceof MulterError)) {
      next(error);
      return;
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Each photo must be 5 MB or smaller'));
      return;
    }
    next(new AppError(400, 'VALIDATION_ERROR', 'Invalid multipart photo upload'));
  });
};

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

export const createListingController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await createListing(authenticatedUser(request).id, request.body as CreateListingInput),
    201,
  );
});

export const listListingsController = asyncHandler(async (request, response) => {
  const query = request.query as unknown as ListListingsQuery;
  if (query.mine && !request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const result = await listListings(
    query,
    request.user,
  );
  sendPaginated(response, result.listings, result.pagination);
});

export const getListingController = asyncHandler(async (request, response) => {
  sendSuccess(response, await getListing(stringParam(request, 'id'), request.user));
});

export const updateListingController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await updateListing(
      authenticatedUser(request).id,
      stringParam(request, 'id'),
      request.body as UpdateListingInput,
    ),
  );
});

export const deleteListingController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await deleteListing(authenticatedUser(request).id, stringParam(request, 'id')),
  );
});

export const uploadListingPhotosController = asyncHandler(async (request, response) => {
  const files = (request.files ?? []) as Express.Multer.File[];
  sendSuccess(
    response,
    await addListingPhotos(
      authenticatedUser(request).id,
      stringParam(request, 'id'),
      files,
    ),
    201,
  );
});

export const deleteListingPhotoController = asyncHandler(async (request, response) => {
  sendSuccess(
    response,
    await deleteListingPhoto(
      authenticatedUser(request),
      stringParam(request, 'id'),
      stringParam(request, 'photoId'),
    ),
  );
});
