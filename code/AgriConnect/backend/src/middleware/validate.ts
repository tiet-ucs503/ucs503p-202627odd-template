import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { AppError, type ErrorFields } from '../common/app-error.js';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function fieldsFromError(error: z.ZodError): ErrorFields {
  const fields: ErrorFields = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    (fields[key] ??= []).push(issue.message);
  }

  return fields;
}

function assignRequestField(
  request: Record<string, unknown>,
  key: 'params' | 'query' | 'body',
  value: unknown,
): void {
  try {
    request[key] = value;
  } catch {
    Object.defineProperty(request, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

export function validate(schemas: RequestSchemas): RequestHandler {
  return (request, _response, next) => {
    try {
      if (schemas.params) {
        assignRequestField(
          request as unknown as Record<string, unknown>,
          'params',
          schemas.params.parse(request.params),
        );
      }
      if (schemas.query) {
        assignRequestField(
          request as unknown as Record<string, unknown>,
          'query',
          schemas.query.parse(request.query),
        );
      }
      if (schemas.body) {
        assignRequestField(
          request as unknown as Record<string, unknown>,
          'body',
          schemas.body.parse(request.body),
        );
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
            fields: fieldsFromError(error),
          }),
        );
        return;
      }
      next(error);
    }
  };
}
