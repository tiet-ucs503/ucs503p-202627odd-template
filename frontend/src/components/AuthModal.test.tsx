// "Sign in with Google" on the sign-in dialog. Google's script is replaced by a stand-in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthModal from '@/components/AuthModal';
import { AuthProvider } from '@/context/AuthContext';
import { installFakeServer } from '@/test/fakeServer';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const user = (role: string) => ({ id: 3, name: 'Alice Example', email: 'alice@gmail.com', role, points: 0, level: 1, link_code: null, is_demo: false });

let googleCallback: ((r: { credential?: string }) => void) | null = null;
const renderButton = vi.fn();
const initialize = vi.fn((config: { callback: (r: { credential?: string }) => void }) => {
  googleCallback = config.callback;
});

beforeEach(() => {
  googleCallback = null;
  vi.clearAllMocks();
  window.google = { accounts: { id: { initialize, renderButton } } };
});
afterEach(() => {
  delete window.google;
});

function setup(health: Record<string, unknown>) {
  const server = installFakeServer({
    '/health': () => health,
    '/auth/google': () => ({ access_token: 'token-from-server', token_type: 'bearer', user: user('parent') }),
  });
  const onSuccess = vi.fn();
  render(
    <AuthProvider>
      <AuthModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />
    </AuthProvider>,
  );
  return { server, onSuccess };
}
const googleCall = (server: ReturnType<typeof installFakeServer>) => server.requests.find((r) => r.url.endsWith('/auth/google'));

describe('Sign in with Google', () => {
  it('is not offered when the server has no Google client ID', async () => {
    const { server } = setup({ status: 'ok', demo_mode: false, google_client_id: null });
    await waitFor(() => expect(server.requests.some((r) => r.url.endsWith('/health'))).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('[data-google-signin]')).toBeNull();
    expect(initialize).not.toHaveBeenCalled();
  });

  it("shows Google's own button, set up with the server's client ID", async () => {
    setup({ status: 'ok', demo_mode: false, google_client_id: CLIENT_ID });
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(initialize.mock.calls[0][0]).toMatchObject({ client_id: CLIENT_ID });
    expect(document.querySelector('[data-google-signin]')).not.toBeNull();
  });

  it('signing in sends only the Google credential, so an existing account is used', async () => {
    const { server, onSuccess } = setup({ status: 'ok', demo_mode: false, google_client_id: CLIENT_ID });
    await waitFor(() => expect(googleCallback).not.toBeNull());
    await act(async () => googleCallback!({ credential: 'google-id-token' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('parent'));
    expect(googleCall(server)!.json).toEqual({ credential: 'google-id-token' });
    expect(localStorage.getItem('mathverse_token')).toBe('token-from-server');
  });

  it('signing up sends the role picked on the dialog, even if it was picked after the button appeared', async () => {
    const { server } = setup({ status: 'ok', demo_mode: false, google_client_id: CLIENT_ID });
    fireEvent.click(screen.getByRole('button', { name: /sign up here/i }));
    await waitFor(() => expect(googleCallback).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /teacher/i }));
    await act(async () => googleCallback!({ credential: 'google-id-token' }));
    await waitFor(() => expect(googleCall(server)).toBeTruthy());
    expect(googleCall(server)!.json).toEqual({ credential: 'google-id-token', role: 'teacher' });
  });

  it("shows the server's message when there is no account yet", async () => {
    const server = installFakeServer({ '/health': () => ({ status: 'ok', demo_mode: false, google_client_id: CLIENT_ID }) });
    render(<AuthProvider><AuthModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} /></AuthProvider>);
    await waitFor(() => expect(googleCallback).not.toBeNull());
    await act(async () => googleCallback!({ credential: 'google-id-token' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy()); // the fake server answers 404
    expect(googleCall(server)).toBeTruthy();
  });

  it('the email and password form still works alongside it', async () => {
    setup({ status: 'ok', demo_mode: false, google_client_id: CLIENT_ID });
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });
});
