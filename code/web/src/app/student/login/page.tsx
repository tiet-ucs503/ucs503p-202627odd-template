'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import { useAuth } from '@/context/AuthContext';
import { getStoredUser } from '@/lib/authStorage';
import { m3Tokens } from '@/theme/tokens';

export default function StudentLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(user.role === 'student' ? '/student' : '/');
  }, [authLoading, user, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Login failed');
      return;
    }

    const stored = getStoredUser<{ role?: string }>();
    if (stored?.role !== 'student') {
      setError(
        'This is an instructor account. Use the instructor dashboard instead.'
      );
      return;
    }

    router.replace('/student');
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
      <Container maxWidth="xs" disableGutters>
        <Card sx={{ borderRadius: m3Tokens.shape.large }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box
                component="img"
                src="/icons/student-192.png"
                alt=""
                sx={{ width: 64, height: 64, borderRadius: 3, mb: 1.5 }}
              />
              <Typography variant="h4" sx={{ color: m3Tokens.color.primary, fontWeight: 900 }}>
                ClassPulse
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  color: m3Tokens.color.secondary,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Student App
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Student Email"
                  type="email"
                  autoComplete="email"
                  fullWidth
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  fullWidth
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
                      Keep me signed in
                    </Typography>
                  }
                  sx={{ mt: -0.5 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  sx={{ py: 1.25, fontWeight: 800, textTransform: 'none' }}
                >
                  {loading ? 'Signing in…' : 'Sign in as Student'}
                </Button>
              </Stack>
            </form>

            <Stack spacing={1.5} sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                New student?{' '}
                <MuiLink
                  component={Link}
                  href="/student/signup"
                  underline="hover"
                  sx={{ fontWeight: 800 }}
                >
                  Create an account
                </MuiLink>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <MuiLink
                  component={Link}
                  href="/student/install"
                  underline="hover"
                  sx={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  <PhoneIphoneIcon sx={{ fontSize: 16 }} />
                  How to install on iPhone
                </MuiLink>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Instructor?{' '}
                <MuiLink component={Link} href="/login" underline="hover" sx={{ fontWeight: 700 }}>
                  Use the instructor dashboard
                </MuiLink>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
