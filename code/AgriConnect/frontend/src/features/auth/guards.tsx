'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import type { Role } from '@/lib/api/types';
import { dashboardPath, useAuth } from './auth-context';

export function RequireAuth({
  roles,
  children,
}: {
  roles?: Role[];
  children: React.ReactNode;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace(dashboardPath(user.role));
    }
  }, [ready, roles, router, user]);

  if (!ready || !user || (roles && !roles.includes(user.role))) {
    return <Spinner />;
  }

  return <>{children}</>;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) {
      router.replace(dashboardPath(user.role));
    }
  }, [ready, router, user]);

  if (!ready || user) return <Spinner />;
  return <>{children}</>;
}
