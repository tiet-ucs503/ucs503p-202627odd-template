import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  AuthUser,
  Institution,
  Membership,
  Role,
  Permission,
  RoleAssignment,
  AuthSession,
  PasswordResetToken,
  WorkspaceType,
  RoleCode
} from '../types';

export type { RoleCode };
export type { WorkspaceType };
import {
  INSTITUTIONS,
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS_MAP,
  USERS,
  INITIAL_MEMBERSHIPS,
  INITIAL_ROLE_ASSIGNMENTS,
  INITIAL_SESSIONS
} from '../lib/authData';
import { supabaseClient } from '../lib/supabaseClient';
import { apiUrl } from '../lib/apiConfig';

export type AuthLifecycleStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

interface AuthContextType {
  currentUser: AuthUser | null;
  currentInstitution: Institution;
  currentMembership: Membership | null;
  currentRole: Role | null;
  userPermissions: string[];
  isAuthenticated: boolean;
  authStatus: AuthLifecycleStatus;
  isAuthLoading: boolean;
  hasPermission: (permissionCode: string) => boolean;

  // Workspace Multi-Role State
  currentWorkspace: WorkspaceType;
  authorizedWorkspaces: WorkspaceType[];
  switchWorkspace: (workspace: WorkspaceType) => void;

  // Real REST Backend Operations
  login: (email: string, password?: string) => Promise<{
    success: boolean;
    message: string;
    pendingApproval?: boolean;
    roleKey?: 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin';
    authorizedWorkspaces?: WorkspaceType[];
    user?: AuthUser;
  }>;
  register: (name: string, email: string, password: string, roleCode?: 'STUDENT' | 'FACULTY' | 'COORDINATOR') => Promise<{
    success: boolean;
    message: string;
    email?: string;
    status?: string;
    roleCode?: string;
  }>;
  loginAsDemoRole: (roleKey: 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin') => Promise<{
    success: boolean;
    message: string;
    roleKey?: 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin';
    authorizedWorkspaces?: WorkspaceType[];
    user?: AuthUser;
  }>;
  resetDemoData: () => Promise<{ success: boolean; message: string }>;
  requestPasswordReset: (email: string) => Promise<{
    success: boolean;
    message: string;
    resetToken?: string;
  }>;
  validateResetToken: (token: string) => Promise<{
    valid: boolean;
    email?: string;
    message?: string;
  }>;
  resetPassword: (token: string, newPassword: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  logout: () => void;
  switchUser: (userId: string) => void;
  updateUserRole: (userId: string, newRoleId: string, reason: string) => void;
  updateUserProfile: (userIdOrUpdates: string | Partial<AuthUser>, maybeUpdates?: Partial<AuthUser>) => Promise<{ success: boolean; message?: string }>;
  addRoleAssignment: (email: string, roleId: string, notes?: string) => void;
  revokeSession: (sessionId: string) => void;

  // Database Tables
  allUsers: AuthUser[];
  allInstitutions: Institution[];
  allMemberships: Membership[];
  allRoleAssignments: RoleAssignment[];
  allRoles: Role[];
  allPermissions: Permission[];
  allSessions: AuthSession[];
  passwordResetTokens: PasswordResetToken[];
  roster?: any;
  [key: string]: any;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [allInstitutions] = useState<Institution[]>(INSTITUTIONS);
  const [currentInstitution] = useState<Institution>(INSTITUTIONS[0]);

  const [allUsers, setAllUsers] = useState<AuthUser[]>(USERS);
  const allUsersRef = useRef(allUsers);
  const [allMemberships, setAllMemberships] = useState<Membership[]>(INITIAL_MEMBERSHIPS);
  const [allRoleAssignments, setAllRoleAssignments] = useState<RoleAssignment[]>(INITIAL_ROLE_ASSIGNMENTS);
  const [allRoles] = useState<Role[]>(ROLES);
  const [allPermissions] = useState<Permission[]>(PERMISSIONS);
  const [allSessions, setAllSessions] = useState<AuthSession[]>(INITIAL_SESSIONS);
  const [passwordResetTokens] = useState<PasswordResetToken[]>([]);

  useEffect(() => {
    allUsersRef.current = allUsers;
  }, [allUsers]);

  // Active authenticated user & session lifecycle
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthLifecycleStatus>('AUTH_LOADING');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceType>('Student');
  const [authorizedWorkspaces, setAuthorizedWorkspaces] = useState<WorkspaceType[]>(['Student']);
  const logoutRequestRef = useRef<Promise<void> | null>(null);

  const switchWorkspace = (ws: WorkspaceType) => {
    if (authorizedWorkspaces.includes(ws)) {
      setCurrentWorkspace(ws);
    }
  };

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return allUsers.find(u => u.id === currentUserId) || null;
  }, [allUsers, currentUserId]);

  // Sync user's authorized workspaces when user changes
  useEffect(() => {
    if (currentUser?.authorizedWorkspaces && currentUser.authorizedWorkspaces.length > 0) {
      setAuthorizedWorkspaces(currentUser.authorizedWorkspaces);
      if (!currentUser.authorizedWorkspaces.includes(currentWorkspace)) {
        setCurrentWorkspace(currentUser.authorizedWorkspaces[0]);
      }
    }
  }, [currentUser]);

  const applyAuthenticatedUser = useCallback((apiUser: any, roleCode?: string, workspaces?: WorkspaceType[]) => {
    if (!apiUser?.id || !apiUser?.email) return null;

    const now = new Date().toISOString();
    const email = String(apiUser.email).trim().toLowerCase();
    const resolvedRoleCode = roleCode || apiUser.roleCode || 'STUDENT';
    const resolvedWorkspaces: WorkspaceType[] = Array.isArray(workspaces) && workspaces.length > 0
      ? workspaces
      : Array.isArray(apiUser.authorizedWorkspaces) && apiUser.authorizedWorkspaces.length > 0
        ? apiUser.authorizedWorkspaces
        : ['Student'];
    const existing = allUsersRef.current.find(user => user.id === apiUser.id || user.email.toLowerCase() === email);
    const user: AuthUser = {
      ...existing,
      id: apiUser.id,
      name: apiUser.name || existing?.name || email.split('@')[0],
      email,
      status: apiUser.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
      emailVerified: apiUser.emailVerified ?? existing?.emailVerified ?? true,
      createdAt: apiUser.createdAt || existing?.createdAt || now,
      updatedAt: apiUser.updatedAt || existing?.updatedAt || now,
      lastLoginAt: apiUser.lastLoginAt || now,
      department: apiUser.department || existing?.department,
      rollNumber: apiUser.profile?.rollNumber ?? apiUser.rollNumber ?? existing?.rollNumber,
      sectionId: apiUser.profile?.sectionId ?? apiUser.sectionId ?? existing?.sectionId,
      subSectionId: apiUser.profile?.subSectionId ?? apiUser.subSectionId ?? existing?.subSectionId,
      crSectionId: apiUser.profile?.crSectionId ?? apiUser.crSectionId ?? existing?.crSectionId,
      facultyId: apiUser.profile?.facultyId ?? apiUser.facultyId ?? existing?.facultyId,
      phone: apiUser.profile?.phone ?? apiUser.phone ?? existing?.phone,
      officeLocation: apiUser.profile?.officeLocation ?? apiUser.officeLocation ?? existing?.officeLocation,
      officeHours: apiUser.profile?.officeHours ?? apiUser.officeHours ?? existing?.officeHours,
      authorizedWorkspaces: resolvedWorkspaces,
      isDemoUser: apiUser.isDemoUser ?? existing?.isDemoUser,
      roleCode: resolvedRoleCode,
      roleName: apiUser.roleName || existing?.roleName,
      hasPassword: apiUser.hasPassword ?? existing?.hasPassword,
    };
    const roleId = allRoles.find(role => role.code === resolvedRoleCode)?.id || 'role-student';

    setAllUsers(prev => [user, ...prev.filter(item => item.id !== user.id && item.email.toLowerCase() !== email)]);
    setAllMemberships(prev => [
      {
        id: `mem-${user.id}`,
        userId: user.id,
        institutionId: currentInstitution.id,
        roleId,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        assignedBy: 'system-auth-session',
      },
      ...prev.filter(membership => membership.userId !== user.id),
    ]);
    setCurrentUserId(user.id);
    setAuthorizedWorkspaces(resolvedWorkspaces);
    setCurrentWorkspace(current => resolvedWorkspaces.includes(current) ? current : resolvedWorkspaces[0]);
    setIsAuthenticated(true);
    setAuthStatus('AUTHENTICATED');
    return user;
  }, [allRoles, currentInstitution.id]);

  // The application session cookie is authoritative; a cached Supabase browser session is not.
  useEffect(() => {
    let isSubscribed = true;

    const restoreSession = async () => {
      setAuthStatus('AUTH_LOADING');
      try {
        const response = await fetch(apiUrl('/api/auth/me'), {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        const data = await response.json().catch(() => ({}));
        if (!isSubscribed) return;

        if (response.ok && data.authenticated && data.user) {
          applyAuthenticatedUser(data.user, data.roleCode, data.authorizedWorkspaces);
        } else {
          setCurrentUserId(null);
          setIsAuthenticated(false);
          setAuthStatus('UNAUTHENTICATED');
        }
      } catch {
        if (!isSubscribed) return;
        setCurrentUserId(null);
        setIsAuthenticated(false);
        setAuthStatus('UNAUTHENTICATED');
      }
    };

    restoreSession();
    return () => { isSubscribed = false; };
  }, [applyAuthenticatedUser]);

  const currentMembership = useMemo(() => {
    if (!currentUser) return null;
    return allMemberships.find(
      m => m.userId === currentUser.id && m.institutionId === currentInstitution.id && m.status === 'ACTIVE'
    ) || null;
  }, [allMemberships, currentUser, currentInstitution]);

  const currentRole = useMemo(() => {
    if (!currentMembership) return null;
    return allRoles.find(r => r.id === currentMembership.roleId) || null;
  }, [allRoles, currentMembership]);

  const userPermissions = useMemo(() => {
    if (!currentMembership) return [];
    return ROLE_PERMISSIONS_MAP[currentMembership.roleId] || [];
  }, [currentMembership]);

  const hasPermission = (permissionCode: string) => {
    return userPermissions.includes(permissionCode);
  };

  /**
   * Helper to map Role Code to Timetable Dashboard Key
   */
  const resolveRoleKey = (roleCode: string): 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin' => {
    switch (roleCode) {
      case 'COORDINATOR':
        return 'Coordinator';
      case 'FACULTY':
        return 'Faculty';
      case 'HOD':
        return 'HOD';
      case 'COLLEGE_ADMIN':
      case 'SUPER_ADMIN':
        return 'Admin';
      case 'CLASS_REPRESENTATIVE':
      case 'STUDENT':
      default:
        return 'Student';
    }
  };

  /**
   * Authenticate against the application API, which issues the authoritative session cookie.
   */
  const login = async (
    email: string,
    password?: string
  ): Promise<{
    success: boolean;
    message: string;
    pendingApproval?: boolean;
    roleKey?: 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin';
    authorizedWorkspaces?: WorkspaceType[];
    user?: AuthUser;
  }> => {
    if (logoutRequestRef.current) await logoutRequestRef.current;
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const resp = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data.success && data.user) {
        const workspaces = data.authorizedWorkspaces || data.user.authorizedWorkspaces;
        const user = applyAuthenticatedUser(data.user, data.roleCode, workspaces);
        if (!user) throw new Error('Authentication response did not include a valid user.');

        return {
          success: true,
          message: data.message || `Welcome, ${user.name}`,
          roleKey: data.role || resolveRoleKey(user.roleCode || 'STUDENT'),
          authorizedWorkspaces: workspaces,
          user,
        };
      } else {
        setIsAuthenticated(false);
        setAuthStatus('UNAUTHENTICATED');
        setCurrentUserId(null);
        return {
          success: false,
          message: data.message || 'Invalid institutional credentials. Please check your email and password.',
          pendingApproval: data.error === 'ACCOUNT_PENDING_APPROVAL',
        };
      }
    } catch {
      setIsAuthenticated(false);
      setAuthStatus('UNAUTHENTICATED');
      setCurrentUserId(null);
      return {
        success: false,
        message: 'Network error connecting to authentication service.',
      };
    }
  };

  /** Submit a role request that remains blocked until an Admin approves it. */
  const register = async (
    name: string,
    email: string,
    password: string,
    roleCode: 'STUDENT' | 'FACULTY' | 'COORDINATOR' = 'STUDENT'
  ): Promise<{
    success: boolean;
    message: string;
    email?: string;
    status?: string;
    roleCode?: string;
  }> => {
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
          credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password, roleCode }),
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data.success) {
        setIsAuthenticated(false);
        setCurrentUserId(null);

        return {
          success: true,
          message: data.message || 'Registration request submitted. Waiting for Admin Approval.',
          email: data.email || email.trim().toLowerCase(),
          status: data.status,
          roleCode: data.roleCode,
        };
      } else {
        setIsAuthenticated(false);
        setCurrentUserId(null);
        return {
          success: false,
          message:
            data.message ||
            (resp.status === 403
              ? "This staff account has not been pre-authorized. Please contact the Dean's Office."
              : resp.status === 409
              ? 'An account with this email already exists. Please sign in instead.'
              : resp.status === 400
              ? 'Invalid registration request or weak password.'
              : 'Registration could not be completed. Please try again later.'),
        };
      }
    } catch {
      setIsAuthenticated(false);
      setCurrentUserId(null);
      return {
        success: false,
        message: 'Unable to connect to registration service.',
      };
    }
  };

  /**
   * One-Click Secure Demo Authentication
   */
  const loginAsDemoRole = async (
    roleKey: 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin'
  ): Promise<{
    success: boolean;
    message: string;
    roleKey?: 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin';
    authorizedWorkspaces?: WorkspaceType[];
    user?: AuthUser;
  }> => {
    if (logoutRequestRef.current) await logoutRequestRef.current;
    try {
      const resp = await fetch(apiUrl('/api/auth/demo-login'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ roleKey }),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success && data.user) {
        const workspaces = data.authorizedWorkspaces || data.user.authorizedWorkspaces;
        const user = applyAuthenticatedUser(data.user, data.roleCode, workspaces);
        if (!user) throw new Error('Authentication response did not include a valid user.');

        return {
          success: true,
          message: data.message || `Welcome, ${user.name}`,
          roleKey: data.role || resolveRoleKey(user.roleCode || 'STUDENT'),
          authorizedWorkspaces: workspaces,
          user,
        };
      } else {
        setIsAuthenticated(false);
        setAuthStatus('UNAUTHENTICATED');
        setCurrentUserId(null);
        return {
          success: false,
          message: data.message || 'Demo authentication failed.',
        };
      }
    } catch {
      setIsAuthenticated(false);
      setAuthStatus('UNAUTHENTICATED');
      setCurrentUserId(null);
      return {
        success: false,
        message: 'Could not connect to demo authentication service.',
      };
    }
  };

  /**
   * Reset Demo Data
   */
  const resetDemoData = async (): Promise<{ success: boolean; message: string }> => {
    try {
      await fetch('/api/demo/reset', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {
      // ignore
    }
    return {
      success: true,
      message: 'Demo dataset restored to initial state.',
    };
  };

  /**
   * REST Backend Forgot Password (POST /api/auth/forgot-password)
   */
  const requestPasswordReset = async (
    email: string
  ): Promise<{
    success: boolean;
    message: string;
    resetToken?: string;
  }> => {
    try {
      const resp = await fetch('/api/auth/forgot-password', {
        method: 'POST',
          credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await resp.json();
      return {
        success: true,
        message: data.message || 'If an account exists for this email, a password reset link has been sent.',
        resetToken: data.resetToken,
      };
    } catch {
      return {
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent.',
      };
    }
  };

  /**
   * REST Backend Validate Token (GET /api/auth/validate-token)
   */
  const validateResetToken = async (
    token: string
  ): Promise<{ valid: boolean; email?: string; message?: string }> => {
    try {
      const resp = await fetch(`/api/auth/validate-token?token=${encodeURIComponent(token)}`);
      const data = await resp.json();
      return {
        valid: data.valid,
        email: data.email,
        message: data.message,
      };
    } catch {
      return { valid: false, message: 'Could not reach token verification service.' };
    }
  };

  /**
   * REST Backend Reset Password (POST /api/auth/reset-password)
   */
  const resetPassword = async (
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
          credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await resp.json();
      return {
        success: data.success,
        message: data.message,
      };
    } catch {
      return {
        success: false,
        message: 'Network error resetting password.',
      };
    }
  };

  const logout = () => {
    // Clear app identity synchronously so a quick-access login cannot inherit stale UI state.
    setIsAuthenticated(false);
    setAuthStatus('UNAUTHENTICATED');
    setCurrentUserId(null);
    setAuthorizedWorkspaces(['Student']);
    setCurrentWorkspace('Student');
    const request = (async () => {
      try {
        await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'same-origin' });
      } catch { /* the server cookie expires on the next request if offline */ }
      if (supabaseClient) {
        try { await supabaseClient.auth.signOut(); }
        catch (err) { console.warn('[AUTH TRACE] Supabase signOut notice:', err); }
      }
    })().finally(() => {
      if (logoutRequestRef.current === request) logoutRequestRef.current = null;
    });
    logoutRequestRef.current = request;
    return request;
  };

  const switchUser = (userId: string) => {
    setCurrentUserId(userId);
    setIsAuthenticated(true);
  };

  const updateUserRole = (userId: string, newRoleId: string, reason: string) => {
    setAllMemberships(prev =>
      prev.map(m =>
        m.userId === userId && m.institutionId === currentInstitution.id
          ? { ...m, roleId: newRoleId, updatedAt: new Date().toISOString() }
          : m
      )
    );
  };

  const updateUserProfile = async (userIdOrUpdates: string | Partial<AuthUser>, maybeUpdates?: Partial<AuthUser>) => {
    let targetUserId = currentUserId;
    let updates = maybeUpdates;
    if (typeof userIdOrUpdates === 'string') {
      targetUserId = userIdOrUpdates;
    } else {
      updates = userIdOrUpdates;
    }
    if (!targetUserId) return { success: false, message: 'No active user' };
    if (targetUserId !== currentUserId) return { success: false, message: 'You can only update your own profile here.' };
    try {
      const response = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phone: updates?.phone,
          officeLocation: updates?.officeLocation,
          officeHours: updates?.officeHours,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false, message: data.message || 'Profile could not be saved.' };
      const profile = data.user?.profile || {};
      setAllUsers(prev => prev.map(user => user.id === targetUserId ? {
        ...user,
        phone: profile.phone ?? user.phone,
        officeLocation: profile.officeLocation ?? user.officeLocation,
        officeHours: profile.officeHours ?? user.officeHours,
        updatedAt: new Date().toISOString(),
      } : user));
      return { success: true, message: data.message || 'Profile saved.' };
    } catch {
      return { success: false, message: 'Could not reach the account service. Profile was not saved.' };
    }
  };

  const addRoleAssignment = (email: string, roleId: string, notes?: string) => {
    const newAssignment: RoleAssignment = {
      id: `ra-${Date.now().toString().slice(-4)}`,
      institutionId: currentInstitution.id,
      email: email.toLowerCase().trim(),
      roleId,
      status: 'PRE_AUTHORIZED',
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAllRoleAssignments(prev => [newAssignment, ...prev]);
  };

  const revokeSession = (sessionId: string) => {
    setAllSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, isRevoked: true } : s))
    );
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentInstitution,
        currentMembership,
        currentRole,
        userPermissions,
        isAuthenticated,
        authStatus,
        isAuthLoading: authStatus === 'AUTH_LOADING',
        hasPermission,
        currentWorkspace,
        authorizedWorkspaces,
        switchWorkspace,
        login,
        register,
        loginAsDemoRole,
        resetDemoData,
        requestPasswordReset,
        validateResetToken,
        resetPassword,
        logout,
        switchUser,
        updateUserRole,
        updateUserProfile,
        addRoleAssignment,
        revokeSession,
        allUsers,
        allInstitutions,
        allMemberships,
        allRoleAssignments,
        allRoles,
        allPermissions,
        allSessions,
        passwordResetTokens,
        roster: currentUser ? {
          rollNumber: currentUser.rollNumber ?? '102303999',
          sectionId: currentUser.sectionId ?? 'sec-cse-a',
          subSectionId: currentUser.subSectionId ?? 'sub-sec-cse-a-1',
          facultyId: currentUser.facultyId,
        } : {
          rollNumber: '102303999',
          sectionId: 'sec-cse-a',
          subSectionId: 'sub-sec-cse-a-1'
        },
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
