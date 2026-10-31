'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, login as loginRequest, logout as logoutRequest, registerAccount } from '@/lib/api/auth';
import { refreshAccessToken } from '@/lib/api/client';
import { tokenStore } from '@/lib/api/token-store';
import type { AuthUser } from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/locales';

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    role: 'FARMER' | 'BUYER';
    phone: string;
    state: string;
    district: string;
    village?: string;
    languagePref?: Locale;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadSession(): Promise<AuthUser | null> {
  const token = tokenStore.get() ?? (await refreshAccessToken());
  if (!token) return null;
  const { data } = await getMe();
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    void loadSession()
      .then(setUser)
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      async login(email, password) {
        const { data } = await loginRequest({ email, password });
        tokenStore.set(data.accessToken);
        const me = await getMe();
        setUser(me.data);
        return me.data;
      },
      async register(input) {
        const { data } = await registerAccount(input);
        tokenStore.set(data.accessToken);
        const me = await getMe();
        setUser(me.data);
        return me.data;
      },
      async logout() {
        try {
          await logoutRequest();
        } finally {
          tokenStore.clear();
          setUser(null);
          router.push('/');
        }
      },
      async refreshUser() {
        const me = await getMe();
        setUser(me.data);
      },
    }),
    [ready, router, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export function dashboardPath(role: AuthUser['role']) {
  if (role === 'FARMER') return '/farmer';
  if (role === 'BUYER') return '/buyer';
  if (role === 'AGRONOMIST') return '/notifications';
  return '/admin';
}
