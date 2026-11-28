import type { AuthUser } from './types';

const STORAGE_KEY = 'agriconnect_access_token';
const USER_KEY = 'agriconnect_cached_user';
let memoryToken: string | null = null;
let memoryUser: AuthUser | null = null;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const tokenStore = {
  get(): string | null {
    if (memoryToken) return memoryToken;
    const storage = getStorage();
    if (storage) {
      try {
        const stored = storage.getItem(STORAGE_KEY);
        if (stored) {
          memoryToken = stored;
          return stored;
        }
      } catch {
        // storage disabled or restricted
      }
    }
    return null;
  },
  set(token: string | null): void {
    memoryToken = token;
    const storage = getStorage();
    if (storage) {
      try {
        if (token) {
          storage.setItem(STORAGE_KEY, token);
        } else {
          storage.removeItem(STORAGE_KEY);
          storage.removeItem(USER_KEY);
          memoryUser = null;
        }
      } catch {
        // storage quota exceeded or restricted
      }
    }
  },
  clear(): void {
    memoryToken = null;
    memoryUser = null;
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
        storage.removeItem(USER_KEY);
      } catch {
        // ignore
      }
    }
  },
};

export const userStore = {
  get(): AuthUser | null {
    if (memoryUser) return memoryUser;
    const storage = getStorage();
    if (storage) {
      try {
        const stored = storage.getItem(USER_KEY);
        if (stored) {
          memoryUser = JSON.parse(stored) as AuthUser;
          return memoryUser;
        }
      } catch {
        // invalid JSON or restricted
      }
    }
    return null;
  },
  set(user: AuthUser | null): void {
    memoryUser = user;
    const storage = getStorage();
    if (storage) {
      try {
        if (user) {
          storage.setItem(USER_KEY, JSON.stringify(user));
        } else {
          storage.removeItem(USER_KEY);
        }
      } catch {
        // storage quota or restricted
      }
    }
  },
  clear(): void {
    memoryUser = null;
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(USER_KEY);
      } catch {
        // ignore
      }
    }
  },
};

