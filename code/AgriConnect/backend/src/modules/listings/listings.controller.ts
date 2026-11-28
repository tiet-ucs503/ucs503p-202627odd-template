import type { Request, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import { emitMarketplaceListingUpdate } from '../../config/socket.js';
import {
  addListingPhotos,
  createListing,
  deleteListing,
  deleteListingPhoto,
  getListing,
  listListings,
  updateListing,
} from './listings.service.js';
import { verifyCropPhoto } from './crop-photo-verifier.js';
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

export const singlePhotoVerifyUpload: RequestHandler = (request, response, next) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
    fileFilter: (_request, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(
          new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, and WebP are allowed'),
        );
        return;
      }
      callback(null, true);
    },
  }).single('file');

  upload(request, response, (error: unknown) => {
    if (!(error instanceof MulterError)) {
      next(error);
      return;
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Photo must be 5 MB or smaller'));
      return;
    }
    next(new AppError(400, 'VALIDATION_ERROR', 'Invalid photo upload'));
  });
};

export const verifyCropPhotoController = asyncHandler(async (request, response) => {
  const file = request.file;
  if (!file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A photo file is required');
  }
  const body = (request.body ?? {}) as Record<string, unknown>;
  const crop = typeof body.crop === 'string' ? body.crop.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : 'other';
  const variety = typeof body.variety === 'string' && body.variety ? body.variety.trim() : null;

  if (!crop) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Crop name is required');
  }

  const result = await verifyCropPhoto(crop, category, variety, file);
  sendSuccess(response, result);
});

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
  const listing = await createListing(authenticatedUser(request).id, request.body as CreateListingInput);
  emitMarketplaceListingUpdate('created', listing);
  sendSuccess(response, listing, 201);
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
  const listing = await updateListing(
    authenticatedUser(request).id,
    stringParam(request, 'id'),
    request.body as UpdateListingInput,
  );
  emitMarketplaceListingUpdate('updated', listing);
  sendSuccess(response, listing);
});

export const deleteListingController = asyncHandler(async (request, response) => {
  const result = await deleteListing(authenticatedUser(request).id, stringParam(request, 'id'));
  emitMarketplaceListingUpdate('deleted', { id: stringParam(request, 'id') });
  sendSuccess(response, result);
});

export const uploadListingPhotosController = asyncHandler(async (request, response) => {
  const files = (request.files ?? []) as Express.Multer.File[];
  const result = await addListingPhotos(
    authenticatedUser(request).id,
    stringParam(request, 'id'),
    files,
  );
  emitMarketplaceListingUpdate('updated', { id: stringParam(request, 'id'), photos: result });
  sendSuccess(response, result, 201);
});

export const deleteListingPhotoController = asyncHandler(async (request, response) => {
  const result = await deleteListingPhoto(
    authenticatedUser(request),
    stringParam(request, 'id'),
    stringParam(request, 'photoId'),
  );
  emitMarketplaceListingUpdate('updated', { id: stringParam(request, 'id'), deletedPhotoId: stringParam(request, 'photoId') });
  sendSuccess(response, result);
});
