'use client';

import React, { useState } from 'react';
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
  Link as MuiLink,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import { useAuth } from '@/context/AuthContext';
import { m3Tokens } from '@/theme/tokens';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teacherInviteCode, setTeacherInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Web signup registers teacher accounts exclusively
    const result = await signup(email, password, fullName, 'teacher', true, teacherInviteCode);
    setLoading(false);

    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Signup failed');
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
            <Typography variant="subtitle2" sx={{ color: m3Tokens.color.secondary, fontWeight: 700, textAlign: 'center', mb: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Instructor Registration
            </Typography>

            <Alert severity="info" icon={<PhoneAndroidIcon fontSize="inherit" />} sx={{ mb: 2.5, fontSize: '0.85rem' }}>
              <strong>Students:</strong> register in the{' '}
              <MuiLink component={Link} href="/student/signup" underline="hover" sx={{ fontWeight: 700 }}>
                ClassPulse student app
              </MuiLink>{' '}
              (works on iPhone, Android, and desktop).
            </Alert>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  label="Instructor Full Name"
                  type="text"
                  fullWidth
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <TextField
                  label="Institutional Email Address"
                  type="email"
                  fullWidth
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  label="Password (min 8 chars)"
                  type="password"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <TextField
                  label="Teacher Invite Code (optional)"
                  type="text"
                  fullWidth
                  value={teacherInviteCode}
                  onChange={(e) => setTeacherInviteCode(e.target.value)}
                  helperText="Provided by your administrator when instructor signup is restricted."
                />

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Register Instructor Account'}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Already registered?{' '}
                <MuiLink component={Link} href="/login" underline="hover" sx={{ fontWeight: 700 }}>
                  Sign In
                </MuiLink>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
