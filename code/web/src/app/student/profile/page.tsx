'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  List,
  ListItem,
  Stack,
  Typography,
} from '@mui/material';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import LogoutIcon from '@mui/icons-material/Logout';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useAuth } from '@/context/AuthContext';
import { getMe } from '@/lib/studentApi';
import { DEFAULT_PWA_STATE, getClientPwaState } from '@/lib/studentPwa';
import { m3Tokens } from '@/theme/tokens';

export default function StudentProfilePage() {
  const { user, loading } = useRequireRole('student', '/student/login');
  const { logout } = useAuth();
  const router = useRouter();
  const [pwa, setPwa] = useState(DEFAULT_PWA_STATE);
  const [refreshedName, setRefreshedName] = useState('');

  useEffect(() => {
    setPwa(getClientPwaState());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) setRefreshedName(me.full_name || '');
      } catch {
        // The cached session is enough for this screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user) return null;

  const name = refreshedName || user.full_name;
  const initial = name?.trim()?.[0]?.toUpperCase() || 'S';

  const handleLogout = () => {
    logout();
    router.replace('/student/login');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Profile
      </Typography>

      <Card
        sx={{
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          boxShadow: 'none',
          mb: 2,
        }}
      >
        <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
          <Avatar
            sx={{
              width: 76,
              height: 76,
              mx: 'auto',
              mb: 1.25,
              bgcolor: m3Tokens.color.primary,
              fontSize: '2rem',
              fontWeight: 900,
            }}
          >
            {initial}
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user.email}
          </Typography>
          <Chip
            label="STUDENT"
            size="small"
            sx={{
              mt: 1,
              fontWeight: 900,
              fontSize: '0.62rem',
              bgcolor: m3Tokens.color.secondaryContainer,
              color: m3Tokens.color.onSecondaryContainer,
            }}
          />
        </CardContent>
      </Card>

      <Card
        sx={{
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          boxShadow: 'none',
          mb: 2,
        }}
      >
        <List disablePadding>
          <ListItem
            component={Link}
            href="/student/install"
            sx={{ color: 'text.primary', textDecoration: 'none' }}
          >
            <ListItemIcon>
              <InstallMobileIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Install ClassPulse"
              secondary={
                pwa.standalone
                  ? 'Installed and running as a web app'
                  : 'Add to your Home Screen on iPhone or Android'
              }
              primaryTypographyProps={{ fontWeight: 800, fontSize: '0.9rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
            <Chip
              label={pwa.standalone ? 'Installed' : 'Install'}
              size="small"
              color={pwa.standalone ? 'success' : 'default'}
              variant={pwa.standalone ? 'filled' : 'outlined'}
              sx={{ fontWeight: 800, fontSize: '0.65rem' }}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemIcon>
              <CameraAltIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Camera troubleshooting"
              secondary="If scanning does not start, check Safari camera settings"
              primaryTypographyProps={{ fontWeight: 800, fontSize: '0.9rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
            <Button
              component={Link}
              href="/student/install"
              size="small"
              sx={{ textTransform: 'none', fontWeight: 800 }}
            >
              Open
            </Button>
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemIcon>
              <ShieldOutlinedIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Appearance mode"
              secondary="Strict light mode, matching the Android app"
              primaryTypographyProps={{ fontWeight: 800, fontSize: '0.9rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemIcon>
              <InfoOutlinedIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="ClassPulse Student"
              secondary="Release 1.0 · iOS 18+ supported"
              primaryTypographyProps={{ fontWeight: 800, fontSize: '0.9rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItem>
        </List>
      </Card>

      <Stack spacing={1.25}>
        <Button
          variant="outlined"
          color="error"
          size="large"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ fontWeight: 800, textTransform: 'none' }}
        >
          Sign out
        </Button>
      </Stack>
    </Box>
  );
}
