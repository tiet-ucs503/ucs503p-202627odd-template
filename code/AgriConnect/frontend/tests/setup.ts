import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { authState, setAuthUser } from './utils/auth-state';

// Screens are client components that assume a router and a session. Both are mocked once
// here so individual suites only have to mock the API wrappers they actually call.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useParams: () => ({ id: 'order-1' }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

vi.mock('@/features/auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  dashboardPath: (role: string) =>
    role === 'FARMER' ? '/farmer' : role === 'BUYER' ? '/buyer' : '/admin',
}));

// jsdom has no layout engine and no media APIs; screens under test only need these to exist.
beforeEach(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  Element.prototype.scrollTo ??= () => undefined;
});

afterEach(() => {
  cleanup();
  setAuthUser(null);
  window.localStorage.clear();
  document.cookie
    .split(';')
    .map((entry) => entry.split('=')[0]?.trim())
    .filter(Boolean)
    .forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0`;
    });
  vi.useRealTimers();
});
