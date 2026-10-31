'use client';

import { AuthProvider } from '@/features/auth/auth-context';
import { LocaleProvider } from '@/features/i18n/locale-context';
import { AppShell } from '@/components/shell';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LocaleProvider>
        <AppShell>{children}</AppShell>
      </LocaleProvider>
    </AuthProvider>
  );
}
