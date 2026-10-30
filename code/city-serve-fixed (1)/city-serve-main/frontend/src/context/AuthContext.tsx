"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAccessToken } from "@/lib/api";
import type { User, Vendor } from "@/types";

interface AuthContextValue {
  user: User | null;
  vendor: Vendor | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get<any>("/auth/me");
      setUser(me);
      setVendor(me.vendor ?? null);
    } catch {
      setUser(null);
      setVendor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  async function login(email: string, password: string) {
    const res = await api.post<any>("/auth/login", { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setVendor(res.vendor ?? null);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
    setVendor(null);
  }

  return (
    <AuthContext.Provider value={{ user, vendor, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
