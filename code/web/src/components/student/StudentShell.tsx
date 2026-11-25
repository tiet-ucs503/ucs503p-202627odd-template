'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppBar,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Button,
  Chip,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import ClassIcon from '@mui/icons-material/Class';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SpeedIcon from '@mui/icons-material/Speed';
import QuizIcon from '@mui/icons-material/Quiz';
import ForumIcon from '@mui/icons-material/Forum';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '@/context/AuthContext';
import { m3Tokens } from '@/theme/tokens';
import InstallBanner from './InstallBanner';

const NAV_ITEMS = [
  { label: 'Classes', href: '/student', icon: <ClassIcon /> },
  { label: 'Attendance', href: '/student/attendance', icon: <EventAvailableIcon /> },
  { label: 'Pulse', href: '/student/pulse', icon: <SpeedIcon /> },
  { label: 'Quizzes', href: '/student/quizzes', icon: <QuizIcon /> },
  { label: 'Forum', href: '/student/doubts', icon: <ForumIcon /> },
];

const BARE_PREFIXES = [
  '/student/login',
  '/student/signup',
  '/student/install',
  '/student/join',
  '/student/offline',
  '/student/scan',
];

function selectedIndex(pathname: string): number {
  if (pathname === '/student' || pathname.startsWith('/student/classrooms')) return 0;
  if (pathname.startsWith('/student/attendance')) return 1;
  if (pathname.startsWith('/student/pulse')) return 2;
  if (pathname.startsWith('/student/quizzes')) return 3;
  if (pathname.startsWith('/student/doubts')) return 4;
  return -1;
}

export default function StudentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const isBare = BARE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isBare) {
    return <>{children}</>;
  }

  const initials = user?.full_name?.trim()?.[0]?.toUpperCase() || 'S';

  const handleLogout = () => {
    setMenuAnchor(null);
    logout();
    router.replace('/student/login');
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: m3Tokens.color.background,
      }}
    >
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          backgroundColor: 'rgba(254, 247, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`,
          pt: 'env(safe-area-inset-top)',
        }}
      >
        <Toolbar sx={{ minHeight: 60, gap: 1 }}>
          <Typography
            component={Link}
            href="/student"
            sx={{
              color: m3Tokens.color.primary,
              fontWeight: 900,
              fontSize: '1.3rem',
              letterSpacing: '-0.5px',
              textDecoration: 'none',
            }}
          >
            ClassPulse
          </Typography>
          <Chip
            label="Student"
            size="small"
            sx={{
              height: 22,
              fontWeight: 700,
              fontSize: '0.68rem',
              bgcolor: m3Tokens.color.secondaryContainer,
              color: m3Tokens.color.onSecondaryContainer,
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Account">
            <Button
              aria-label="Open account menu"
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              sx={{ minWidth: 0, p: 0.5, borderRadius: '50%' }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: m3Tokens.color.primary,
                  fontSize: '0.95rem',
                  fontWeight: 800,
                }}
              >
                {initials}
              </Avatar>
            </Button>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
            {user?.full_name || 'Student'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.email || ''}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          component={Link}
          href="/student/profile"
          onClick={() => setMenuAnchor(null)}
        >
          <ListItemIcon>
            <AccountCircleIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem
          component={Link}
          href="/student/install"
          onClick={() => setMenuAnchor(null)}
        >
          <ListItemIcon>
            <InstallMobileIcon fontSize="small" />
          </ListItemIcon>
          Install app
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: m3Tokens.color.error }}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: m3Tokens.color.error }} />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 760,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          pt: 2,
          pb: 'calc(84px + env(safe-area-inset-bottom))',
        }}
      >
        <InstallBanner />
        {children}
      </Box>

      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: `1px solid ${m3Tokens.color.outlineVariant}`,
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigation
          showLabels
          value={selectedIndex(pathname)}
          sx={{
            height: 64,
            maxWidth: 760,
            mx: 'auto',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              px: 0.5,
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.68rem',
              fontWeight: 700,
            },
          }}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.href}
              label={item.label}
              icon={item.icon}
              component={Link}
              href={item.href}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
