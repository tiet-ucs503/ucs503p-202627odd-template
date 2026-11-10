import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  userId: number;
  name: string;
  email: string;
  role: 'student' | 'parent' | 'teacher';
  points: number;
  level: number;
  student_code?: string;
  linked_student_id?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: string, studentEmail?: string) => Promise<User>;
  demoLogin: (role: 'student' | 'parent' | 'teacher') => Promise<User>;
  logout: () => void;
  linkStudent: (studentEmailOrCode: string) => Promise<void>;
  updateUserPoints: (additionalPoints: number) => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = 'http://localhost:8001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mathverse_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('mathverse_token') || null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('mathverse_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mathverse_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('mathverse_token', token);
    } else {
      localStorage.removeItem('mathverse_token');
    }
  }, [token]);

  const login = async (email: string, password: string): Promise<User> => {
    localStorage.removeItem('mathverse_state');
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to login');
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.access_token);
    setIsAuthModalOpen(false);
    return data.user;
  };

  const register = async (name: string, email: string, password: string, role: string, studentEmail?: string): Promise<User> => {
    localStorage.clear();
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        student_email: studentEmail ? studentEmail.trim().toLowerCase() : null,
        student_code: studentEmail ? studentEmail.trim() : null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to register');
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.access_token);
    // Initialize clean state for new user
    localStorage.setItem(`mathverse_state_user_${data.user.userId}`, JSON.stringify({
      spiderPoints: 0,
      unlockedBosses: ['goblin'],
      missionsCompleted: 0
    }));
    setIsAuthModalOpen(false);
    return data.user;
  };

  const demoLogin = async (role: 'student' | 'parent' | 'teacher'): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/demo/${role}`, {
      method: 'POST',
    });
    if (!res.ok) {
      // Fallback demo user if backend offline
      const fallbackUser: User = {
        userId: role === 'student' ? 1 : (role === 'parent' ? 2 : 3),
        name: role === 'student' ? 'Peter Parker' : (role === 'parent' ? 'Aunt May' : 'Prof. Curt Connors'),
        email: `${role}@mathverse.edu`,
        role,
        points: role === 'student' ? 850 : 0,
        level: role === 'student' ? 3 : 1,
        student_code: 'SPIDER-2026',
        linked_student_id: 1,
      };
      setUser(fallbackUser);
      setToken('mock_jwt_token_demo');
      setIsAuthModalOpen(false);
      return fallbackUser;
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.access_token);
    setIsAuthModalOpen(false);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.clear();
  };

  const linkStudent = async (studentEmailOrCode: string) => {
    if (!token && !user) return;
    const res = await fetch(`${API_BASE}/reports/link-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ student_code_or_id: studentEmailOrCode.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not link student');
    }
    const data = await res.json();
    if (user && data.student) {
      const updated = { ...user, linked_student_id: data.student.userId };
      setUser(updated);
      localStorage.setItem('mathverse_user', JSON.stringify(updated));
    }
  };

  const updateUserPoints = (additionalPoints: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, points: Math.max(0, (prev.points || 0) + additionalPoints) };
      localStorage.setItem('mathverse_user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        register,
        demoLogin,
        logout,
        linkStudent,
        updateUserPoints,
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

