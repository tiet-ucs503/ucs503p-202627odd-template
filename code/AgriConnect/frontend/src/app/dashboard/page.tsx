'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { dashboardPath, useAuth } from '@/features/auth/auth-context';
import { Spinner } from '@/components/ui';

export default function DashboardRedirectPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? dashboardPath(user.role) : '/login');
  }, [ready, router, user]);

  return <Spinner />;
}
