'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type User } from '@/context/AuthContext';
import { roleHomePath } from '@/lib/authRouting';

/**
 * Guards a surface by role and sends the user to the right place:
 * - unauthenticated -> the surface's login page
 * - authenticated but wrong role -> that role's home surface
 */
export function useRequireRole(
  role: User['role'],
  loginPath: string
): { user: User | null; loading: boolean } {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(loginPath);
      return;
    }

    if (user.role !== role) {
      router.replace(roleHomePath(user.role));
    }
  }, [user, loading, role, loginPath, router]);

  const ready = !loading && !!user && user.role === role;
  return { user: ready ? user : null, loading: !ready };
}
