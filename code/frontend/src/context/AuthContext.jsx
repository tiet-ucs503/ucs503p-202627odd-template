import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth';

/**
 * AuthContext.jsx - Global authentication state for TravelSphere.
 *
 * Provides:
 *   user       - current user object (from GET /api/users/me) or null
 *   loading    - true while the initial token restore is in progress
 *   login()    - POST /api/auth/login, stores JWT, fetches /users/me
 *   register() - POST /api/auth/register (no auto-login; caller redirects to /login)
 *   logout()   - POST /api/auth/logout, removes JWT, clears user
 *
 * Consume via the useAuth() hook inside any component wrapped by AuthProvider.
 */

const AuthContext = createContext(null);
const TOKEN_KEY = 'access_token';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true until initial restore completes

  // On mount: if a token exists in localStorage, restore the session
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) { setLoading(false); return; }
      try {
        const res = await authApi.getMe();
        setUser(res.data);
      } catch {
        // Token is expired or invalid — discard it
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  /** Log in: exchange credentials for a JWT, then fetch the user profile. */
  const login = useCallback(async ({ username, password }) => {
    const res = await authApi.login({ username, password });
    const { access_token } = res.data;
    localStorage.setItem(TOKEN_KEY, access_token);
    const meRes = await authApi.getMe();
    setUser(meRes.data);
  }, []);

  /**
   * Register a new account.
   * Backend returns the created user (no token); caller must redirect to /login.
   */
  const register = useCallback(async ({ username, email, password, full_name }) => {
    await authApi.register({ username, email, password, full_name });
    // No auto-login — registration response does not include an access_token
  }, []);

  /** Log out: invalidate server session and clear local state. */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server call fails, clear client state
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** useAuth — consume the AuthContext. Must be inside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}