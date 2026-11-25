'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import { m3Tokens } from '@/theme/tokens';
import {
  INSTALL_BANNER_DISMISSED_KEY,
  getClientPwaState,
} from '@/lib/studentPwa';

const HIDDEN_PATHS = [
  '/student/install',
  '/student/login',
  '/student/signup',
  '/student/offline',
  '/student/scan',
];

type BannerMode = 'none' | 'ios' | 'in-app';

export default function InstallBanner() {
  const pathname = usePathname();
  const [mode, setMode] = useState<BannerMode>('none');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const state = getClientPwaState();
    let nextMode: BannerMode = 'none';

    if (!state.standalone) {
      if (state.isInApp) nextMode = 'in-app';
      else if (state.isIos) nextMode = 'ios';
    }

    setMode(nextMode);

    try {
      setDismissed(
        window.localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY) === '1'
      );
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  };

  if (
    mode === 'none' ||
    dismissed ||
    HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return null;
  }

  if (mode === 'in-app') {
    return (
      <Box sx={{ px: 2, pt: 1.5 }}>
        <Alert
          severity="info"
          icon={<OpenInBrowserIcon fontSize="inherit" />}
          action={
            <IconButton
              aria-label="Dismiss install hint"
              size="small"
              onClick={handleDismiss}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{ borderRadius: m3Tokens.shape.medium, alignItems: 'center' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Open this page in Safari to install ClassPulse.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tap the browser menu (or share button) and choose “Open in Safari”.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pt: 1.5 }}>
      <Alert
        severity="info"
        icon={<PhoneIphoneIcon fontSize="inherit" />}
        action={
          <IconButton
            aria-label="Dismiss install hint"
            size="small"
            onClick={handleDismiss}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          borderRadius: m3Tokens.shape.medium,
          alignItems: 'center',
          '& .MuiAlert-message': { width: '100%' },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Install ClassPulse for the full-screen experience.
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          Tap <IosShareIcon sx={{ fontSize: 13, verticalAlign: 'text-bottom' }} />{' '}
          Share, then “Add to Home Screen”.
        </Typography>
        <Button
          component={Link}
          href="/student/install"
          size="small"
          sx={{ mt: 1, px: 0, fontWeight: 700, textTransform: 'none' }}
          endIcon={<IosShareIcon fontSize="small" />}
        >
          Show me how
        </Button>
      </Alert>
    </Box>
  );
}
