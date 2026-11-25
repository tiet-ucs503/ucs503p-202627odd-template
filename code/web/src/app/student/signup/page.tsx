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
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import { useAuth } from '@/context/AuthContext';
import { m3Tokens } from '@/theme/tokens';

export default function StudentSignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signup, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(user.role === 'student' ? '/student' : '/');
  }, [authLoading, user, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await signup(email, password, fullName, 'student', true);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Signup failed');
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
                Create Student Account
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
                  label="Full Name"
                  type="text"
                  autoComplete="name"
                  fullWidth
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
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
                  label="Password (min 8 chars)"
                  type="password"
                  autoComplete="new-password"
                  fullWidth
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <TextField
                  label="Confirm Password"
                  type="password"
                  autoComplete="new-password"
                  fullWidth
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  sx={{ py: 1.25, fontWeight: 800, textTransform: 'none' }}
                >
                  {loading ? 'Creating account…' : 'Create Student Account'}
                </Button>
              </Stack>
            </form>

            <Stack spacing={1.5} sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Already registered?{' '}
                <MuiLink
                  component={Link}
                  href="/student/login"
                  underline="hover"
                  sx={{ fontWeight: 800 }}
                >
                  Sign in
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
                  Install on iPhone
                </MuiLink>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
