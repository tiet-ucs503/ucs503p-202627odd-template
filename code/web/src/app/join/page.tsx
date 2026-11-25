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
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen';
import { m3Tokens } from '@/theme/tokens';
import { getClientPwaState } from '@/lib/studentPwa';

export default function JoinPage() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('code');
    setCode(raw ? raw.trim().toUpperCase() : '');
    setIsIos(getClientPwaState().isIos);
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The code is still visible to type manually.
    }
  };

  const studentJoinHref = code ? `/student/join?code=${encodeURIComponent(code)}` : '/student';

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
        <Card sx={{ borderRadius: m3Tokens.shape.large }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: m3Tokens.color.primaryContainer,
                color: m3Tokens.color.onPrimaryContainer,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <PhoneIphoneIcon sx={{ fontSize: 38 }} />
            </Box>

            <Typography variant="h4" sx={{ color: m3Tokens.color.primary, fontWeight: 900, mb: 0.5 }}>
              ClassPulse
            </Typography>
            <Typography variant="subtitle1" sx={{ color: m3Tokens.color.onSurface, fontWeight: 800, mb: 0.5 }}>
              Join a classroom
            </Typography>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 3 }}>
              Use the ClassPulse student app on iPhone, Android, or in your browser.
            </Typography>

            {code === null ? null : code ? (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: 800,
                    color: m3Tokens.color.onSurfaceVariant,
                    mb: 1,
                  }}
                >
                  Classroom join code
                </Typography>
                <Box
                  sx={{
                    p: { xs: 2.5, sm: 3 },
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
                      letterSpacing: '8px',
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
                  sx={{ mb: 3, fontWeight: 800, textTransform: 'none', px: 3 }}
                >
                  {copied ? 'Copied!' : 'Copy code'}
                </Button>
              </>
            ) : (
              <Alert severity="warning" sx={{ mb: 3, textAlign: 'left', borderRadius: 2 }}>
                <strong>No join code found.</strong> Ask your instructor for the
                6-character code, then reopen the link they shared.
              </Alert>
            )}

            <Divider sx={{ mb: 3 }} />

            <Stack spacing={1.5} sx={{ textAlign: 'left', mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface }}>
                How to join
              </Typography>
              {isIos ? (
                <>
                  <Step n={1}>
                    Open this page in Safari, then tap{' '}
                    <IosShareIcon sx={{ fontSize: 15, verticalAlign: 'text-bottom' }} />{' '}
                    Share.
                  </Step>
                  <Step n={2}>
                    Choose <strong>Add to Home Screen</strong>{' '}
                    <AddToHomeScreenIcon sx={{ fontSize: 15, verticalAlign: 'text-bottom' }} />{' '}
                    and open ClassPulse from your Home Screen.
                  </Step>
                  <Step n={3}>
                    Sign in, tap <strong>Join</strong>, and paste the code above.
                  </Step>
                </>
              ) : (
                <>
                  <Step n={1}>Install the Android app or open the ClassPulse web app.</Step>
                  <Step n={2}>Sign in with your student account.</Step>
                  <Step n={3}>
                    Tap <strong>Join</strong> and enter the code above.
                  </Step>
                </>
              )}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 3 }}>
              <Button
                component={Link}
                href={studentJoinHref}
                variant="contained"
                fullWidth
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Open student app
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

            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Are you an instructor?{' '}
              <MuiLink component={Link} href="/login" underline="hover" sx={{ fontWeight: 800 }}>
                Sign in to the web dashboard
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
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Chip
        label={n}
        size="small"
        sx={{
          height: 22,
          minWidth: 22,
          fontWeight: 800,
          bgcolor: m3Tokens.color.secondaryContainer,
          color: m3Tokens.color.onSecondaryContainer,
        }}
      />
      <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
        {children}
      </Typography>
    </Stack>
  );
}
