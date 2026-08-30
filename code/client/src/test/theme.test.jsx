import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ThemeSwitcher from '../components/common/ThemeSwitcher';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function TestComponent() {
  const { theme, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <ThemeSwitcher />
    </div>
  );
}

describe('ThemeSwitcher Component', () => {
  it('opens dropdown and changes theme when an option is clicked', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTitle(/Toggle color theme/i);
    expect(toggleBtn).toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(toggleBtn);

    // Click 'Light' option
    const lightOption = screen.getByRole('button', { name: /light/i });
    fireEvent.click(lightOption);

    // Verify theme changed to light
    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
