import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setAuthToken, setUnauthorizedHandler, Role, TokenResponse, User } from '@/lib/api';

export type { User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True while a saved login is being checked with the server on page load. */
  loading: boolean;
  /** True only when the server has DEMO_MODE switched on. */
  demoEnabled: boolean;
  /** The server's Google client ID, or null when Google sign-in is not set up. */
  googleClientId: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: Role) => Promise<User>;
  demoLogin: (role: Role) => Promise<User>;
  /** role is needed only to create a new account. */
  googleLogin: (credential: string, role?: Role) => Promise<User>;
  logout: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Only the token is kept in the browser. The user's details, points and level
// always come from the server, so they cannot go stale or be edited locally.
const TOKEN_KEY = 'mathverse_token';

function readSavedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => readSavedToken() !== null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: nothing to clear */
    }
  }, []);

  const signIn = useCallback((data: TokenResponse): User => {
    setAuthToken(data.access_token);
    try {
      localStorage.setItem(TOKEN_KEY, data.access_token);
    } catch {
      /* storage unavailable: the login lasts until the page is closed */
    }
    setUser(data.user);
    setIsAuthModalOpen(false);
    return data.user;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // On page load: restore a saved login, and ask whether demo mode is on.
  useEffect(() => {
    api<{ demo_mode: boolean; google_client_id?: string | null }>('/health')
      .then((h) => {
        setDemoEnabled(h.demo_mode);
        setGoogleClientId(h.google_client_id || null);
      })
      .catch(() => {
        setDemoEnabled(false);
        setGoogleClientId(null);
      });

    const saved = readSavedToken();
    if (!saved) return;
    setAuthToken(saved);
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email: string, password: string) =>
    signIn(await api<TokenResponse>('/auth/login', { body: { email, password } }));

  const register = async (name: string, email: string, password: string, role: Role) =>
    signIn(await api<TokenResponse>('/auth/register', { body: { name, email, password, role } }));

  const demoLogin = async (role: Role) =>
    signIn(await api<TokenResponse>(`/auth/demo/${role}`, { method: 'POST' }));

  const googleLogin = async (credential: string, role?: Role) =>
    signIn(await api<TokenResponse>('/auth/google', { body: role ? { credential, role } : { credential } }));

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        demoEnabled,
        googleClientId,
        login,
        register,
        demoLogin,
        googleLogin,
        logout,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
