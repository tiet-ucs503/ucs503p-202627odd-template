import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '@/app/forgot-password/page';
import ResetPasswordPage from '@/app/reset-password/page';
import { pa, renderWithLocale } from '../utils/render';

vi.mock('@/lib/api/auth', () => ({
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

describe('password screens in Punjabi', () => {
  it('translates the forgot-password form', () => {
    renderWithLocale(<ForgotPasswordPage />);

    expect(screen.getByText(pa('password.forgotTitle'))).toBeInTheDocument();
    expect(screen.getByText(pa('password.email'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pa('password.send') })).toBeInTheDocument();
    expect(screen.queryByText('Forgot password')).not.toBeInTheDocument();
  });

  it('translates the missing-token warning on the reset screen', async () => {
    renderWithLocale(<ResetPasswordPage />);

    expect(await screen.findByText(pa('password.missingToken'))).toBeInTheDocument();
  });
});
