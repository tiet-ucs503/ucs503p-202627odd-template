import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ActiveTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ActiveTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved as ThemeMode;
    return 'light';
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>(() => {
    if (themeMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themeMode === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', themeMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const computeActiveTheme = (): ActiveTheme => {
      if (themeMode === 'system') {
        return mediaQuery.matches ? 'dark' : 'light';
      }
      return themeMode === 'dark' ? 'dark' : 'light';
    };

    const resolved = computeActiveTheme();
    setActiveTheme(resolved);

    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    const handleChange = () => {
      if (themeMode === 'system') {
        const sysTheme = mediaQuery.matches ? 'dark' : 'light';
        setActiveTheme(sysTheme);
        if (sysTheme === 'dark') {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
    };

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    setThemeModeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
