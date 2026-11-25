// Demo accounts must be visibly labelled on screen; real accounts must not be.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '@/App';
import { installFakeServer } from '@/test/fakeServer';

vi.mock('@/lib/attention/detector', () => ({ createFaceDetector: vi.fn() }));

const parent = (is_demo: boolean) => ({
  id: 2, name: 'Pat Parent', email: 'pat@example.com', role: 'parent',
  points: 0, level: 1, link_code: null, is_demo,
});

function signedInAs(user: object) {
  localStorage.setItem('mathverse_token', 'test-token');
  installFakeServer({
    '/health': () => ({ status: 'ok', demo_mode: true }),
    '/auth/me': () => user,
    '/guardians/students': () => [],
  });
}

describe('demo banner', () => {
  it('is shown on screen for a demo account', async () => {
    signedInAs(parent(true));
    render(<App />);
    expect(await screen.findByText(/Demo account\. Everything shown here is sample data/i)).toBeTruthy();
  });

  it('is not shown for a real account', async () => {
    signedInAs(parent(false));
    render(<App />);
    await screen.findByText(/Connect a student/i); // the parent page has loaded
    expect(screen.queryByText(/Demo account\./i)).toBeNull();
  });
});
