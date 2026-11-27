import type { CookieOptions } from 'express';
import { getEnv } from './env.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function refreshCookieOptions(): CookieOptions {
  const isProduction = getEnv().NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    // Cross-origin deployments (e.g. Vercel frontend + Render backend) require
    // SameSite='none' with Secure=true so browsers include the refresh cookie
    // on cross-origin fetch requests.
    sameSite: isProduction ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: SEVEN_DAYS_MS,
  };
}

export function clearRefreshCookieOptions(): CookieOptions {
  const options = refreshCookieOptions();
  delete options.maxAge;
  return options;
}
