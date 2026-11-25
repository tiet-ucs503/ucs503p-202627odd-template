// Email validation and the "check your email" step of the sign-up dialog.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthModal from '@/components/AuthModal';
import { AuthProvider } from '@/context/AuthContext';
import { installFakeServer } from '@/test/fakeServer';
import { emailProblem } from '@/lib/emailCheck';

const HEALTH = { status: 'ok', demo_mode: false, google_client_id: null };
const miles = { id: 7, name: 'Miles', email: 'miles@example.com', role: 'student', points: 0, level: 1, link_code: 'SPIDER-ABC234', is_demo: false };

function setup(routes: Record<string, () => unknown> = {}) {
  const server = installFakeServer({ '/health': () => HEALTH, ...routes });
  const onSuccess = vi.fn();
  render(<AuthProvider><AuthModal isOpen onClose={vi.fn()} onSuccess={onSuccess} /></AuthProvider>);
  return { server, onSuccess };
}
const sent = (server: ReturnType<typeof installFakeServer>, path: string) =>
  server.requests.filter((r) => r.url.endsWith(path));
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('email address check', () => {
  it.each([
    ['', 'Enter your email address.'],
    ['miles', 'exactly one @'],
    ['miles@@example.com', 'exactly one @'],
    ['miles@example', 'full email address'],
    ['miles@.com', 'full email address'],
    ['@example.com', 'full email address'],
    ['miles morales@example.com', 'spaces'],
  ])('rejects %j', (email, message) => {
    expect(emailProblem(email)).toContain(message);
  });

  it.each(['miles@example.com', ' Miles.Morales@Example.CO.UK ', 'm+maths@school.edu'])('accepts %j', (email) => {
    expect(emailProblem(email)).toBeNull();
  });
});

describe('the sign-in and sign-up form', () => {
  it('explains a badly typed email and sends nothing', async () => {
    const { server } = setup();
    type(/email address/i, 'miles@example');
    type(/password/i, 'whatever-123');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(/full email address/i)).toBeTruthy();
    expect(screen.getByLabelText(/email address/i).getAttribute('aria-invalid')).toBe('true');
    expect(sent(server, '/auth/login')).toHaveLength(0);
  });

  it('asks for a longer password when signing up', async () => {
    const { server } = setup();
    fireEvent.click(screen.getByRole('button', { name: /sign up here/i }));
    type(/^name$/i, 'Miles');
    type(/email address/i, 'miles@example.com');
    type(/password/i, 'short');
    fireEvent.click(screen.getByRole('button', { name: /create student account/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeTruthy();
    expect(sent(server, '/auth/register')).toHaveLength(0);
  });
});

describe('verifying the email after sign-up', () => {
  const signUp = () => {
    fireEvent.click(screen.getByRole('button', { name: /sign up here/i }));
    type(/^name$/i, '  Miles ');
    type(/email address/i, '  Miles@Example.COM ');
    type(/password/i, 'web-slinger-1');
    fireEvent.click(screen.getByRole('button', { name: /create student account/i }));
  };

  it('signs up with a tidy email, then asks for the code instead of signing in', async () => {
    const { server, onSuccess } = setup({
      '/auth/register': () => ({ verification_required: true, email: 'miles@example.com', email_sent: true, resend_after_seconds: 60 }),
    });
    signUp();
    expect(await screen.findByText(/check your email/i)).toBeTruthy();
    expect(sent(server, '/auth/register')[0].json).toEqual({
      name: 'Miles', email: 'miles@example.com', password: 'web-slinger-1', role: 'student',
    });
    expect(screen.getByRole('status').textContent).toContain('miles@example.com');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem('mathverse_token')).toBeNull();
  });

  it('the right code signs the student in', async () => {
    const { server, onSuccess } = setup({
      '/auth/register': () => ({ verification_required: true, email: 'miles@example.com', email_sent: true, resend_after_seconds: 60 }),
      '/auth/verify-email': () => ({ access_token: 'verified-token', token_type: 'bearer', user: miles }),
    });
    signUp();
    await screen.findByText(/check your email/i);
    type(/6-digit code/i, '12a3 456');
    expect((screen.getByLabelText(/6-digit code/i) as HTMLInputElement).value).toBe('123456'); // digits only
    fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('student'));
    expect(sent(server, '/auth/verify-email')[0].json).toEqual({ email: 'miles@example.com', code: '123456' });
    expect(localStorage.getItem('mathverse_token')).toBe('verified-token');
  });

  it('shows the server message for a wrong code and stays on the code step', async () => {
    setup({
      '/auth/register': () => ({ verification_required: true, email: 'miles@example.com', email_sent: true, resend_after_seconds: 60 }),
      '/auth/verify-email': () => ({ __status: 400, body: { detail: 'That code is not right. 4 tries left.' } }),
    });
    signUp();
    await screen.findByText(/check your email/i);
    type(/6-digit code/i, '000000');
    fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));
    expect((await screen.findByRole('alert')).textContent).toContain('4 tries left');
    expect(screen.getByLabelText(/6-digit code/i)).toBeTruthy();
  });

  it('a new code can be asked for only after the wait', async () => {
    const { server } = setup({
      '/auth/register': () => ({ verification_required: true, email: 'miles@example.com', email_sent: true, resend_after_seconds: 0 }),
      '/auth/resend-code': () => ({ message: 'sent', resend_after_seconds: 60 }),
    });
    signUp();
    await screen.findByText(/check your email/i);
    fireEvent.click(screen.getByRole('button', { name: /^send a new code$/i }));
    await waitFor(() => expect(sent(server, '/auth/resend-code')).toHaveLength(1));
    expect(sent(server, '/auth/resend-code')[0].json).toEqual({ email: 'miles@example.com' });
    const button = await screen.findByRole('button', { name: /send a new code in \d+s/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('says so when the email could not be sent', async () => {
    setup({
      '/auth/register': () => ({ verification_required: true, email: 'miles@example.com', email_sent: false, resend_after_seconds: 0 }),
    });
    signUp();
    expect((await screen.findByRole('status')).textContent).toMatch(/could not send/i);
  });

  it('logging in before verifying leads to the code step', async () => {
    setup({ '/auth/login': () => ({ __status: 403, body: { detail: 'Please verify your email first.' } }) });
    type(/email address/i, 'miles@example.com');
    type(/password/i, 'web-slinger-1');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(/check your email/i)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('verify your email');
  });
});

describe('Google sign-in availability', () => {
  it('asks the server again when it did not answer at first, so the Google button is not lost', async () => {
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
    let calls = 0;
    installFakeServer({
      '/health': () => (++calls === 1
        ? { __status: 503, body: { detail: 'starting' } }
        : { status: 'ok', demo_mode: false, google_client_id: 'test-client.apps.googleusercontent.com' }),
    });
    render(<AuthProvider><AuthModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} /></AuthProvider>);
    await waitFor(() => expect(document.querySelector('[data-google-signin]')).not.toBeNull(), { timeout: 4000 });
    expect(calls).toBeGreaterThanOrEqual(2);
    delete window.google;
  });
});
