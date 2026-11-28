import type { Response } from 'express';
import type { ErrorFields } from './app-error.js';

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function sendSuccess(
  response: Response,
  data: unknown,
  statusCode = 200,
  meta?: unknown,
): Response {
  response.set('Cache-Control', 'no-store');
  if (meta !== undefined) {
    return response.status(statusCode).json({ success: true, data, meta });
  }
  return response.status(statusCode).json({ success: true, data });
}

export function sendPaginated(
  response: Response,
  data: unknown[],
  pagination: Pagination,
): Response {
  response.set('Cache-Control', 'no-store');
  return response.status(200).json({ success: true, data, pagination });
}

export function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string,
  fields?: ErrorFields,
): Response {
  const error = fields ? { code, message, fields } : { code, message };
  return response.status(statusCode).json({ success: false, error });
}
