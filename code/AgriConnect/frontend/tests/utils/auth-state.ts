import type { AuthUser } from '@/lib/api/types';

/**
 * Mutable stand-in for the session. `tests/setup.ts` mocks `auth-context` against this
 * object, so a test can pick the signed-in role before rendering a screen.
 */
export const authState: { user: AuthUser | null; ready: boolean } = {
  user: null,
  ready: true,
};

export const FARMER: AuthUser = {
  id: 'farmer-1',
  email: 'farmer@example.test',
  name: 'Gurpreet Singh',
  role: 'FARMER',
  state: 'Punjab',
  district: 'Ludhiana',
  languagePref: 'pa',
} as AuthUser;

export const BUYER: AuthUser = {
  ...FARMER,
  id: 'buyer-1',
  email: 'buyer@example.test',
  name: 'Ravi Kumar',
  role: 'BUYER',
} as AuthUser;

export const ADMIN: AuthUser = {
  ...FARMER,
  id: 'admin-1',
  email: 'admin@example.test',
  name: 'Admin',
  role: 'ADMIN',
} as AuthUser;

export function setAuthUser(user: AuthUser | null) {
  authState.user = user;
  authState.ready = true;
}
