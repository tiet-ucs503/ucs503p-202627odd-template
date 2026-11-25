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
  Container,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen';
import { m3Tokens } from '@/theme/tokens';
import { DEFAULT_PWA_STATE, getClientPwaState } from '@/lib/studentPwa';

export default function StudentJoinPage() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState(DEFAULT_PWA_STATE);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('code');
    setCode(raw ? raw.trim().toUpperCase() : '');
    setState(getClientPwaState());
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the code is still visible.
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: m3Tokens.color.background,
        py: 4,
        px: 2,
      }}
    >
      <Container maxWidth="sm" disableGutters>
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 4 }, textAlign: 'center' }}>
            <Box
              component="img"
              src="/icons/student-192.png"
              alt=""
              sx={{ width: 64, height: 64, borderRadius: 3, mb: 1.5 }}
            />
            <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.primary }}>
              ClassPulse
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your instructor has invited you to a classroom.
            </Typography>

            {code === null ? null : code ? (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    fontWeight: 800,
                    color: m3Tokens.color.onSurfaceVariant,
                    mb: 1,
                  }}
                >
                  Classroom join code
                </Typography>
                <Box
                  sx={{
                    p: { xs: 2, sm: 3 },
                    borderRadius: m3Tokens.shape.large,
                    backgroundColor: m3Tokens.color.primaryContainer,
                    color: m3Tokens.color.onPrimaryContainer,
                    mb: 2,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: '2rem', sm: '2.75rem' },
                      fontWeight: 900,
                      letterSpacing: { xs: '6px', sm: '10px' },
                      fontFamily: 'monospace',
                      lineHeight: 1.2,
                      wordBreak: 'break-all',
                    }}
                  >
                    {code}
                  </Typography>
                </Box>
                <Button
                  variant={copied ? 'outlined' : 'contained'}
                  color={copied ? 'success' : 'primary'}
                  startIcon={copied ? <CheckCircleIcon /> : <ContentCopyIcon />}
                  onClick={handleCopy}
                  sx={{ fontWeight: 800, textTransform: 'none', mb: 3 }}
                >
                  {copied ? 'Copied!' : 'Copy code'}
                </Button>
              </>
            ) : (
              <Alert severity="warning" sx={{ mb: 3, textAlign: 'left', borderRadius: 2 }}>
                <strong>No join code found.</strong> Ask your instructor for the
                6-character code and reopen their link.
              </Alert>
            )}

            <Divider sx={{ mb: 3 }} />

            <Stack spacing={1.25} sx={{ textAlign: 'left', mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                {state.isIos ? 'How to join on iPhone' : 'How to join'}
              </Typography>
              {state.isIos ? (
                <>
                  <Step n={1}>
                    Open this page in Safari. If you are inside WhatsApp or
                    Instagram, use its menu to open in Safari.
                  </Step>
                  <Step n={2}>
                    Tap{' '}
                    <IosShareIcon sx={{ fontSize: 15, verticalAlign: 'text-bottom' }} />{' '}
                    Share, then <strong>Add to Home Screen</strong>.
                    <AddToHomeScreenIcon
                      sx={{ fontSize: 15, verticalAlign: 'text-bottom', ml: 0.5 }}
                    />
                  </Step>
                  <Step n={3}>
                    Open ClassPulse from the Home Screen, sign in, then paste the
                    code above into <strong>Join</strong>.
                  </Step>
                </>
              ) : (
                <>
                  <Step n={1}>Install the ClassPulse Android app or open the web app.</Step>
                  <Step n={2}>Sign in with your student account.</Step>
                  <Step n={3}>
                    Tap <strong>Join classroom</strong> and enter the code above.
                  </Step>
                </>
              )}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                component={Link}
                href="/student"
                variant="contained"
                fullWidth
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Open ClassPulse
              </Button>
              <Button
                component={Link}
                href="/student/install"
                variant="outlined"
                fullWidth
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Install guide
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              Student?{' '}
              <MuiLink component={Link} href="/student/login" underline="hover" sx={{ fontWeight: 800 }}>
                Sign in
              </MuiLink>
              {' · '}
              <MuiLink component={Link} href="/student/signup" underline="hover" sx={{ fontWeight: 800 }}>
                Create account
              </MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Chip
        label={n}
        size="small"
        sx={{
          minWidth: 22,
          height: 22,
          fontWeight: 800,
          bgcolor: m3Tokens.color.secondaryContainer,
          color: m3Tokens.color.onSecondaryContainer,
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Stack>
  );
}
