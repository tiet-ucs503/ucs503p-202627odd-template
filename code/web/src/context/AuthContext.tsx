'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthToken, getStoredUser, persistAuth, clearAuthStorage, isTokenExpired } from '@/lib/authStorage';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'teacher' | 'student';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, full_name: string, role: 'teacher' | 'student', rememberMe?: boolean, teacherInviteCode?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check persistent storage first, then fall back to session storage
    const storedToken = getAuthToken();
    const storedUser = getStoredUser<User>();

    if (storedToken && storedUser) {
      // The instructor dashboard and the student PWA share this provider.
      // Route-level guards decide which role may access which surface.
      if (isTokenExpired(storedToken)) {
        clearAuthStorage();
      } else {
        setToken(storedToken);
        setUser(storedUser);
      }
    } else if (storedToken || storedUser) {
      // Clean up a partially-written or malformed session
      clearAuthStorage();
    }
    setLoading(false);
  }, []);

  // If the JWT expires while the dashboard is open, drop the session so the
  // page's auth guard can redirect instead of leaving stale 401-driven UI.
  useEffect(() => {
    if (!token) return undefined;

    const checkExpiry = () => {
      if (isTokenExpired(token)) {
        clearAuthStorage();
        setToken(null);
        setUser(null);
      }
    };

    const interval = window.setInterval(checkExpiry, 60_000);
    document.addEventListener('visibilitychange', checkExpiry);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, [token]);

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setToken(data.token);
      setUser(data.user);

      persistAuth(data.token, data.user, rememberMe);

      return { success: true };
    } catch {
      return { success: false, error: 'Network error connecting to backend server' };
    }
  };

  const signup = async (
    email: string,
    password: string,
    full_name: string,
    role: 'teacher' | 'student',
    rememberMe: boolean = true,
    teacherInviteCode?: string
  ) => {
    try {
      const body: Record<string, unknown> = { email, password, full_name, role };
      if (role === 'teacher' && teacherInviteCode?.trim()) {
        body.teacher_invite_code = teacherInviteCode.trim();
      }

      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Signup failed' };
      }

      setToken(data.token);
      setUser(data.user);

      persistAuth(data.token, data.user, rememberMe);

      return { success: true };
    } catch {
      return { success: false, error: 'Network error connecting to backend server' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearAuthStorage();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
