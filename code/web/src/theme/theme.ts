'use client';

import { createTheme } from '@mui/material/styles';
import { m3Tokens } from './tokens';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: m3Tokens.color.primary,
      contrastText: m3Tokens.color.onPrimary,
    },
    secondary: {
      main: m3Tokens.color.secondary,
      contrastText: m3Tokens.color.onSecondary,
    },
    error: {
      main: m3Tokens.color.error,
      contrastText: m3Tokens.color.onError,
    },
    background: {
      default: m3Tokens.color.background,
      paper: '#FFFFFF',
    },
    text: {
      primary: m3Tokens.color.onSurface,
      secondary: m3Tokens.color.onSurfaceVariant,
    },
    divider: m3Tokens.color.outlineVariant,
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: m3Tokens.typography.fontFamily,
    h4: {
      fontWeight: 600,
      letterSpacing: '0px',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '0px',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '0.15px',
    },
    subtitle1: {
      fontWeight: 500,
      letterSpacing: '0.15px',
    },
    body1: {
      letterSpacing: '0.25px',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      letterSpacing: '0.1px',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          padding: '8px 20px',
          boxShadow: 'none',
        },
        containedPrimary: {
          backgroundColor: m3Tokens.color.primary,
          color: m3Tokens.color.onPrimary,
          '&:hover': {
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          boxShadow: 'none',
          backgroundColor: '#FFFFFF',
          '&:hover': {
            boxShadow: '0px 2px 8px rgba(0,0,0,0.06)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: m3Tokens.color.onSurface,
          boxShadow: 'none',
          borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
        },
        rounded: {
          borderRadius: '12px',
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
      styleOverrides: {
        tooltip: {
          backgroundColor: '#FFFFFF',
          color: m3Tokens.color.onSurface,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          borderRadius: '8px',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.12)',
          padding: '6px 10px',
          fontSize: '0.75rem',
          fontWeight: 500,
        },
        arrow: {
          color: '#FFFFFF',
        },
      },
    },
  },
});
