import React from 'react';
import { AuthPage as AuthPageComponent } from '@/components/ui/auth-page';

export default function AuthPage({ initialMode = 'login', onNavigateHome }) {
  return <AuthPageComponent initialMode={initialMode} onNavigateHome={onNavigateHome} />;
}
