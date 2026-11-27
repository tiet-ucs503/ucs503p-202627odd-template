import type { Request } from 'express';

export function isTestTokenAllowed(req?: Pick<Request, 'headers'>): boolean {
  return (
    process.env.NODE_ENV === 'test' &&
    process.env.ALLOW_TEST_RESET_TOKEN === 'true' &&
    req?.headers['x-test-mode'] === 'true'
  );
}
