import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendPaginated, sendSuccess } from '../../common/response.js';
import type { CreateMessageInput, ListMessagesQuery } from './messages.schema.js';
import {
  createMessage,
  listMessages,
  markMessagesRead,
} from './messages.service.js';

function authenticated(request: Request) {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}

function orderId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST', 'Order id is required');
  }
  return id;
}

export const listMessagesController = asyncHandler(async (request, response) => {
  const result = await listMessages(
    authenticated(request),
    orderId(request),
    request.query as unknown as ListMessagesQuery,
  );
  sendPaginated(response, result.messages, result.pagination);
});

export const createMessageController = asyncHandler(async (request, response) => {
  const message = await createMessage(
    authenticated(request),
    orderId(request),
    request.body as CreateMessageInput,
  );
  sendSuccess(response, message, 201);
});

export const markMessagesReadController = asyncHandler(async (request, response) => {
  const result = await markMessagesRead(authenticated(request), orderId(request));
  sendSuccess(response, result);
});
