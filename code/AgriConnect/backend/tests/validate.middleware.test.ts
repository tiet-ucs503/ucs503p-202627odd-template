import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';

describe('validate middleware', () => {
  it('replaces getter-only query with parsed values (Express 5)', () => {
    const handler = validate({
      query: z.object({
        page: z.coerce.number().int(),
        mine: z.enum(['true', 'false']).transform((value) => value === 'true'),
      }),
    });

    const request = {} as Request;
    Object.defineProperty(request, 'query', {
      get() {
        return { page: '2', mine: 'true' };
      },
      enumerable: true,
      configurable: true,
    });

    let nextError: unknown;
    handler(request, {} as Response, (error?: unknown) => {
      nextError = error;
    });

    expect(nextError).toBeUndefined();
    expect(request.query).toEqual({ page: 2, mine: true });
  });
});
