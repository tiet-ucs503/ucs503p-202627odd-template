import type { CookieOptions } from 'express';
import { getEnv } from './env.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: getEnv().NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: SEVEN_DAYS_MS,
  };
}

export function clearRefreshCookieOptions(): CookieOptions {
  const options = refreshCookieOptions();
  delete options.maxAge;
  return options;
}
