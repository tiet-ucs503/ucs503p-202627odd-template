'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Container,
  FormControlLabel,
  Checkbox,
  Link as MuiLink,
  IconButton,
  InputAdornment,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '@/context/AuthContext';
import { getAuthToken, getStoredUser, isTokenExpired } from '@/lib/authStorage';
import { m3Tokens } from '@/theme/tokens';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Surface redirect reasons from apiFetch/session guards.
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'session_expired') {
      setNotice('Your session expired. Please sign in again.');
    } else if (reason === 'instructor_only') {
      setNotice(
        'The web dashboard is for instructors only. Student accounts use the ClassPulse student web app.'
      );
    }

    // A valid session should skip the form and go to its own surface.
    const storedToken = getAuthToken();
    const storedUser = getStoredUser<{ role?: string }>();
    if (storedToken && !isTokenExpired(storedToken) && storedUser?.role) {
      router.replace(storedUser.role === 'student' ? '/student' : '/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (result.success) {
      const storedUser = getStoredUser<{ role: string }>();
      if (storedUser?.role === 'student') {
        router.replace('/student');
        return;
      }
      router.push('/');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: m3Tokens.color.background,
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Card sx={{ p: 2, borderRadius: m3Tokens.shape.large }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: m3Tokens.color.primary, fontWeight: 800, textAlign: 'center', mb: 0.5 }}>
              ClassPulse
            </Typography>
            <Typography variant="subtitle2" sx={{ color: m3Tokens.color.secondary, fontWeight: 700, textAlign: 'center', mb: 3, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Instructor Dashboard
            </Typography>

            {notice && (
              <Alert severity="info" sx={{ mb: 2.5 }}>
                {notice}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Instructor Email"
                  type="email"
                  fullWidth
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                      onChange={(e) => setRememberMe(e.target.checked)}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, fontWeight: 500 }}>
                      Keep me signed in
                    </Typography>
                  }
                  sx={{ mt: -0.5, mb: 0.5 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{ py: 1.25 }}
                >
                  {loading ? 'Signing in...' : 'Sign In as Instructor'}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                New Instructor?{' '}
                <MuiLink component={Link} href="/signup" underline="hover" sx={{ fontWeight: 700 }}>
                  Register Instructor Account
                </MuiLink>
              </Typography>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1.5 }}>
                Student?{' '}
                <MuiLink component={Link} href="/student/login" underline="hover" sx={{ fontWeight: 700 }}>
                  Open the student app
                </MuiLink>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
