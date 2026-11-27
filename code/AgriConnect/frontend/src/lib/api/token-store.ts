const STORAGE_KEY = 'agriconnect_access_token';
let memoryToken: string | null = null;

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
        }
      } catch {
        // storage quota exceeded or restricted
      }
    }
  },
  clear(): void {
    memoryToken = null;
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },
};
