'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { m3Tokens } from '@/theme/tokens';
import { DEFAULT_PWA_STATE, getClientPwaState } from '@/lib/studentPwa';

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Chip
        label={number}
        size="small"
        sx={{
          mt: 0.25,
          minWidth: 26,
          height: 26,
          fontWeight: 800,
          bgcolor: m3Tokens.color.primaryContainer,
          color: m3Tokens.color.onPrimaryContainer,
        }}
      />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          {children}
        </Typography>
      </Box>
    </Stack>
  );
}

export default function StudentInstallPage() {
  const [state, setState] = useState(DEFAULT_PWA_STATE);

  useEffect(() => {
    setState(getClientPwaState());
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        backgroundColor: m3Tokens.color.background,
        px: 2,
        py: 4,
      }}
    >
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <Stack spacing={1} alignItems="center" sx={{ mb: 3, textAlign: 'center' }}>
          <Box
            component="img"
            src="/icons/student-192.png"
            alt=""
            sx={{
              width: 72,
              height: 72,
              borderRadius: 4,
              boxShadow: '0 8px 24px rgba(103, 80, 164, 0.25)',
            }}
          />
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Install ClassPulse
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add ClassPulse to your Home Screen for a full-screen, app-like
            experience. This works on iPhone and iPad without the App Store.
          </Typography>
        </Stack>

        {state.standalone && (
          <Alert
            severity="success"
            icon={<CheckCircleIcon />}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            You are already using the installed ClassPulse app.
          </Alert>
        )}

        {state.isInApp && (
          <Alert
            severity="warning"
            icon={<OpenInBrowserIcon />}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Open this page in Safari first.
            </Typography>
            <Typography variant="body2">
              You are in an app&apos;s built-in browser. Tap its menu and choose
              “Open in Safari”, then follow the steps below.
            </Typography>
          </Alert>
        )}

        {state.isIos && !state.supportedIos && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            ClassPulse is officially supported on iOS 18 and newer. You can
            continue, but camera behaviour may be less reliable on older
            versions.
          </Alert>
        )}

        <Card sx={{ borderRadius: 3, mb: 2 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <PhoneIphoneIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                iPhone / iPad
              </Typography>
            </Stack>

            <Stack spacing={2.25}>
              <Step number={1} title="Open ClassPulse in Safari">
                If you tapped a link inside WhatsApp, Instagram, or another app,
                use that app&apos;s menu to open it in Safari first.
              </Step>
              <Step number={2} title="Tap the Share button">
                It is the square with an arrow pointing up, usually at the
                bottom of Safari.
                <IosShareIcon
                  sx={{ fontSize: 16, verticalAlign: 'text-bottom', ml: 0.5 }}
                />
              </Step>
              <Step number={3} title="Choose “Add to Home Screen”">
                Scroll the share sheet if needed, then tap{' '}
                <strong>Add to Home Screen</strong>.
                <AddToHomeScreenIcon
                  sx={{ fontSize: 16, verticalAlign: 'text-bottom', ml: 0.5 }}
                />
              </Step>
              <Step number={4} title="Keep “Open as Web App” turned on">
                On iOS 26 the switch is shown in the add sheet. On iOS 18
                ClassPulse opens standalone automatically.
              </Step>
              <Step number={5} title="Open ClassPulse from the Home Screen">
                Tap <strong>Add</strong>, then launch the new ClassPulse icon and
                sign in with your student account.
              </Step>
            </Stack>

            <Alert severity="warning" sx={{ mt: 2.5, borderRadius: 2 }}>
              <strong>Install before signing in.</strong> The installed app has
              its own storage, so a session started in Safari will not carry
              over automatically.
            </Alert>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, mb: 2 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <CameraAltIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Camera and QR scanning
              </Typography>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                When you tap <strong>Start camera</strong> in the scanner, allow
                camera access. iOS may ask again the next time you launch the
                installed app; this is a known Safari/WebKit behaviour.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                If the camera does not start, check{' '}
                <strong>Settings → Safari → Camera</strong>, close the app from
                the app switcher, and reopen it.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                If the installed app still cannot use the camera, open ClassPulse
                in Safari and use the scanner there. The attendance flow is the
                same.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              Android
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can keep using the native ClassPulse Android app, or install
              this web app from Chrome&apos;s menu with “Install app” / “Add to
              Home screen”.
            </Typography>
          </CardContent>
        </Card>

        <Divider sx={{ mb: 3 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            component={Link}
            href="/student"
            variant="contained"
            size="large"
            fullWidth
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            Continue to ClassPulse
          </Button>
          <Button
            component={Link}
            href="/student/login"
            variant="outlined"
            size="large"
            fullWidth
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            Sign in
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
