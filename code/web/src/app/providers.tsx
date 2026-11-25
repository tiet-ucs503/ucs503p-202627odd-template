'use client';

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '@/theme/theme';
import { AuthProvider } from '@/context/AuthContext';

/**
 * Client-only providers shared by the instructor dashboard and the student PWA.
 *
 * Keeping this in a separate component lets the root layout stay a server
 * component, which is required for Next.js metadata (manifest, apple-touch-icon,
 * theme color, etc.) on the student routes.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
