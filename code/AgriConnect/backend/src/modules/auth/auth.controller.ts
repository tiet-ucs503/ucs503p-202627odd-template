import type { Request, Response } from 'express';
import { AppError } from '../../common/app-error.js';
import { asyncHandler } from '../../common/async-handler.js';
import { sendSuccess } from '../../common/response.js';
import {
  clearRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from '../../config/cookies.js';
import {
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  refreshSession,
  register,
  resetPassword,
} from './auth.service.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schemas.js';

function requestMeta(request: Request) {
  const userAgent = request.get('user-agent');
  return {
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(request.ip === undefined ? {} : { ip: request.ip }),
  };
}

function requestRefreshToken(request: Request): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE_NAME];
  return typeof value === 'string' ? value : undefined;
}

function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie(
    REFRESH_COOKIE_NAME,
    clearRefreshCookieOptions(),
  );
}

export const registerController = asyncHandler(async (request, response) => {
  const result = await register(request.body as RegisterInput, requestMeta(request));
  setRefreshCookie(response, result.refreshToken);
  sendSuccess(
    response,
    { accessToken: result.accessToken, user: result.user },
    201,
  );
});

export const loginController = asyncHandler(async (request, response) => {
  const result = await login(request.body as LoginInput, requestMeta(request));
  setRefreshCookie(response, result.refreshToken);
  sendSuccess(response, { accessToken: result.accessToken, user: result.user });
});

export const refreshController = asyncHandler(async (request, response) => {
  const result = await refreshSession(
    requestRefreshToken(request),
    requestMeta(request),
  );
  setRefreshCookie(response, result.refreshToken);
  sendSuccess(response, { accessToken: result.accessToken });
});

export const logoutController = asyncHandler(async (request, response) => {
  await logout(
    requestRefreshToken(request),
    request.user?.id,
  );
  clearRefreshCookie(response);
  sendSuccess(response, { loggedOut: true });
});

export const meController = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const user = await getCurrentUser(request.user.id);
  sendSuccess(response, user);
});

export const forgotPasswordController = asyncHandler(async (request, response) => {
  await forgotPassword(request.body as ForgotPasswordInput);
  sendSuccess(response, {
    message: 'If that email is registered, a reset link has been sent.',
  });
});

export const resetPasswordController = asyncHandler(async (request, response) => {
  await resetPassword(request.body as ResetPasswordInput);
  sendSuccess(response, { reset: true });
});
