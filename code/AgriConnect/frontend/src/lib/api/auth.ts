import { apiRequest } from './client';
import type { AuthUser } from './types';
import type { Locale } from '@/lib/i18n/locales';

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export function registerAccount(body: {
  email: string;
  password: string;
  name: string;
  role: 'FARMER' | 'BUYER';
  phone: string;
  state: string;
  district: string;
  village?: string;
  languagePref?: Locale;
}) {
  return apiRequest<AuthSession>('/api/v1/auth/register', {
    method: 'POST',
    body,
    skipAuth: true,
    skipRefresh: true,
  });
}

export function login(body: { email: string; password: string }) {
  return apiRequest<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body,
    skipAuth: true,
    skipRefresh: true,
  });
}

export function logout() {
  return apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', {
    method: 'POST',
    skipRefresh: true,
  });
}

export function getMe() {
  return apiRequest<AuthUser>('/api/v1/auth/me');
}

export function forgotPassword(email: string) {
  return apiRequest<{ message: string }>('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuth: true,
    skipRefresh: true,
  });
}

export function resetPassword(body: { token: string; password: string }) {
  return apiRequest<{ reset: boolean }>('/api/v1/auth/reset-password', {
    method: 'POST',
    body,
    skipAuth: true,
    skipRefresh: true,
  });
}
