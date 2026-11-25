'use client';

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  IconButton,
  Stack,
  Menu,
  MenuItem,
  Avatar,
  Button,
} from '@mui/material';
import ClassIcon from '@mui/icons-material/Class';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SpeedIcon from '@mui/icons-material/Speed';
import QuizIcon from '@mui/icons-material/Quiz';
import ForumIcon from '@mui/icons-material/Forum';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '@/context/AuthContext';
import { m3Tokens } from '@/theme/tokens';

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: number;
  onTabChange?: (index: number) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab: controlledActiveTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;

  const { user, logout } = useAuth();

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  const navItems = [
    { label: 'Classrooms', icon: <ClassIcon />, disabled: false, tooltip: 'Manage and view your classrooms' },
    { label: 'Attendance', icon: <EventAvailableIcon />, disabled: false, tooltip: 'Attendance sessions and reports' },
    { label: 'PulseMeter', icon: <SpeedIcon />, disabled: false, tooltip: 'Real-time student feedback meter and polls' },
    { label: 'Quizzes', icon: <QuizIcon />, disabled: false, tooltip: 'Live classroom quizzes and leaderboards' },
    { label: 'Forum', icon: <ForumIcon />, disabled: false, tooltip: 'Doubt resolution and discussion forum' },
    { label: 'Profile', icon: <AccountCircleIcon />, disabled: false, tooltip: 'Account settings & profile' },
  ];

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (!navItems[newValue].disabled) {
      if (onTabChange) {
        onTabChange(newValue);
      } else {
        setInternalTab(newValue);
      }
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: m3Tokens.color.background }}>
      {/* Top Application Bar */}
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.primary, letterSpacing: '-0.5px' }}>
              ClassPulse
            </Typography>
            <Chip
              label="Instructor Dashboard"
              size="small"
              color="primary"
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
          </Stack>

          {/* User Profile & Logout */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' }, color: m3Tokens.color.onSurface }}>
              {user?.full_name}
            </Typography>
            <Tooltip title="Instructor Account Options">
              <IconButton onClick={handleProfileMenuOpen} color="primary" size="small">
                <Avatar sx={{ bgcolor: m3Tokens.color.primary, width: 34, height: 34, fontSize: '0.85rem' }}>
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'I'}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={handleLogout}
              startIcon={<LogoutIcon fontSize="small" />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                borderColor: m3Tokens.color.outlineVariant,
                color: m3Tokens.color.onSurfaceVariant,
                '&:hover': {
                  borderColor: m3Tokens.color.error,
                  color: m3Tokens.color.error,
                },
              }}
            >
              Sign Out
            </Button>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {user?.full_name || 'Instructor'}
                </Typography>
                <Typography variant="caption" sx={{ color: m3Tokens.color.secondary }}>
                  {user?.email}
                </Typography>
              </Box>
              <MenuItem onClick={handleLogout} sx={{ color: m3Tokens.color.error }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                Sign Out
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>

        {/* Primary Navigation Bar */}
        <Box sx={{ borderTop: `1px solid ${m3Tokens.color.outlineVariant}`, px: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
          >
            {navItems.map((item, index) => (
              <Tab
                key={item.label}
                disabled={item.disabled}
                label={
                  <Tooltip title={item.tooltip} arrow placement="bottom">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{item.label}</span>
                      {item.disabled && (
                        <Chip
                          label="Coming soon"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            backgroundColor: m3Tokens.color.surfaceVariant,
                            color: m3Tokens.color.onSurfaceVariant,
                            fontWeight: 600,
                          }}
                        />
                      )}
                    </Stack>
                  </Tooltip>
                }
                icon={item.icon}
                iconPosition="start"
                sx={{
                  opacity: item.disabled ? 0.45 : 1,
                  minHeight: 48,
                  fontWeight: activeTab === index ? 700 : 500,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              />
            ))}
          </Tabs>
        </Box>
      </AppBar>

      {/* Main Content Area */}
      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 4 }}>
        {children}
      </Container>
    </Box>
  );
};
