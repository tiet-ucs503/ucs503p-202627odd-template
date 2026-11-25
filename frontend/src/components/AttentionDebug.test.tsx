// The camera test readout (?attentionDebug=1): off unless asked for, text only,
// and it must not change anything that is measured, sent or stored.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MissionPlayer from '@/components/MissionPlayer';
import { AttentionAccumulator, CALIBRATION_MS, FaceSample, isFacingScreen, PITCH_LIMIT_DEG, YAW_LIMIT_DEG } from '@/lib/attention/summary';
import { installFakeServer } from '@/test/fakeServer';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, name: 'Tester', role: 'student', is_demo: false } }),
}));
vi.mock('@/context/GameContext', () => ({
  useGame: () => ({
    progress: { points: 0, level: 1, unlocked_bosses: ['goblin'], missions_won: 0, link_code: null },
    setProgress: vi.fn(),
  }),
}));
vi.mock('@/lib/attention/detector', () => ({
  createFaceDetector: vi.fn(async () => ({
    detect: () => ({ facePresent: true, yawDeg: 2, pitchDeg: -1, eyesClosed: false }),
    close: vi.fn(),
  })),
}));

function fakeCamera() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
}

const renderMission = () => render(<MissionPlayer bossId="goblin" onExit={vi.fn()} feedbackMs={20} />);
const choose = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const readout = (root: HTMLElement) => root.querySelector('[data-attention-debug]');
const setAddress = (search: string) => window.history.replaceState({}, '', `/${search}`);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => setAddress(''));

describe('the camera test readout', () => {
  it('is not there unless the address asks for it', async () => {
    installFakeServer();
    fakeCamera();
    const view = renderMission();
    choose(/enable camera/i);
    await screen.findByRole('button', { name: /camera on/i });
    await pause(400);
    expect(readout(view.container)).toBeNull();
  });

  it('shows the live numbers as text only, and cannot be clicked', async () => {
    setAddress('?attentionDebug=1');
    installFakeServer();
    fakeCamera();
    const view = renderMission();
    choose(/enable camera/i);
    await screen.findByRole('button', { name: /camera on/i });

    await waitFor(() => expect(readout(view.container)!.textContent).toContain('face present: yes'), { timeout: 3000 });
    const box = readout(view.container)!;
    expect(box.textContent).toContain('head turn (yaw): 2.0 deg');
    expect(box.textContent).toContain('head tilt (pitch): -1.0 deg');
    expect(box.textContent).toContain('eyes closed: no');
    expect(box.textContent).toMatch(/calibrating, \d\.\d s left/);
    expect(box.querySelector('img, video, canvas')).toBeNull();
    expect(box.className).toContain('pointer-events-none');
    expect(box.getAttribute('aria-hidden')).toBe('true');
  });

  it('changes nothing that is sent: same fields, and the summary is not reset by looking at it', async () => {
    const play = async (search: string) => {
      setAddress(search);
      localStorage.clear(); // so the camera question is asked again on the second run
      const server = installFakeServer();
      fakeCamera();
      const view = renderMission();
      choose(/enable camera/i);
      await screen.findByRole('button', { name: /camera on/i });
      await screen.findByRole('button', { name: /^A\s*1$/ });
      await pause(700); // the readout, if shown, has looked at the summary at least twice by now
      choose(/^A\s*1$/);
      await waitFor(() => expect(server.answers()).toHaveLength(1));
      view.unmount();
      return server;
    };
    const plain = await play('');
    const debug = await play('?attentionDebug=1');

    const [a] = plain.answers();
    const [b] = debug.answers();
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    const sent = b.attention as Record<string, number>;
    expect(Object.keys(sent).sort()).toEqual(Object.keys(a.attention!).sort());
    expect(sent.face_present_pct).toBe(100);
    expect(sent.on_screen_pct).toBe(100);
    // Had the readout reset the counters, only the last quarter second would be left.
    expect(sent.sample_seconds).toBeGreaterThanOrEqual(0.5);
    // The readout itself made no request of its own.
    expect(debug.requests.length).toBe(plain.requests.length);
  });

  it('says there are no readings when the camera is not in use, and attention stays empty', async () => {
    setAddress('?attentionDebug=1');
    const server = installFakeServer();
    fakeCamera();
    const view = renderMission();
    choose(/continue without camera/i);
    await waitFor(() => expect(readout(view.container)!.textContent).toContain('no readings'));
    expect(readout(view.container)!.textContent).toContain('camera: off');
    await screen.findByRole('button', { name: /^A\s*1$/ });
    choose(/^A\s*1$/);
    await waitFor(() => expect(server.answers()).toHaveLength(1));
    expect(server.answers()[0].attention).toBeNull();
  });
});

describe('what the readout reads from the accumulator', () => {
  const facing: FaceSample = { facePresent: true, yawDeg: 4, pitchDeg: -2, eyesClosed: false };

  it('reports the time left while calibrating, then the baseline', () => {
    const acc = new AttentionAccumulator();
    expect(acc.calibration(0)).toEqual({ baseline: null, msLeft: CALIBRATION_MS });
    acc.add(facing, 1000);
    acc.add(facing, 3000);
    expect(acc.calibration(3000)).toEqual({ baseline: null, msLeft: CALIBRATION_MS - 2000 });
    for (let t = 3100; t <= 1000 + CALIBRATION_MS + 100; t += 100) acc.add(facing, t);
    const done = acc.calibration(99999);
    expect(done.msLeft).toBe(0);
    expect(done.baseline!.yaw).toBeCloseTo(4, 5);
    expect(done.baseline!.pitch).toBeCloseTo(-2, 5);
  });

  it('reading the calibration or the summary changes nothing', () => {
    const acc = new AttentionAccumulator();
    for (let t = 0; t < 2000; t += 100) acc.add(facing, t);
    const before = acc.summary();
    acc.calibration(2000);
    acc.summary();
    expect(acc.summary()).toEqual(before);
  });

  it('uses the same facing rule as the stored summary', () => {
    const base = { yaw: 4, pitch: -2 };
    expect(isFacingScreen(facing, base)).toBe(true);
    expect(isFacingScreen({ ...facing, yawDeg: 4 + YAW_LIMIT_DEG }, base)).toBe(true);
    expect(isFacingScreen({ ...facing, yawDeg: 4 + YAW_LIMIT_DEG + 1 }, base)).toBe(false);
    expect(isFacingScreen({ ...facing, pitchDeg: -2 - PITCH_LIMIT_DEG - 1 }, base)).toBe(false);
  });
});
