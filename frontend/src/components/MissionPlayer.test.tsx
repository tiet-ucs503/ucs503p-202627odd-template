// Camera behaviour of the mission screen (tests T1–T5 in docs/AUDIT_AND_PLAN.md).
// The camera and the face model are faked here; everything else is the real app
// code, talking to a fake server that records what it is sent.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MissionPlayer from '@/components/MissionPlayer';
import { installFakeServer, QUESTIONS_TO_WIN } from '@/test/fakeServer';

const USER_ID = 7;
const closeDetector = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, name: 'Tester', role: 'student', is_demo: false } }),
}));
vi.mock('@/context/GameContext', () => ({
  useGame: () => ({
    progress: { points: 0, level: 1, unlocked_bosses: ['goblin'], missions_won: 0, link_code: null },
    setProgress: vi.fn(),
  }),
}));
// The real detector runs a WebAssembly face model, which the test browser cannot do.
vi.mock('@/lib/attention/detector', () => ({
  createFaceDetector: vi.fn(async () => ({
    detect: () => ({ facePresent: true, yawDeg: 2, pitchDeg: -1, eyesClosed: false }),
    close: closeDetector,
  })),
}));

function fakeCamera() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  return { track, getUserMedia };
}

function brokenCamera(errorName: string) {
  const getUserMedia = vi.fn(async () => {
    throw new DOMException('camera problem', errorName);
  });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  return { getUserMedia };
}

const renderMission = () => render(<MissionPlayer bossId="goblin" onExit={vi.fn()} feedbackMs={20} />);
const choose = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Answers the question on screen and waits until the game has moved on. */
async function answerQuestion() {
  const shown = (await screen.findByText(/^Question \d+$/)).textContent;
  choose(/^A\s*1$/);
  await waitFor(() => {
    const now = screen.queryByText(/^Question \d+$/)?.textContent;
    expect(now !== shown || screen.queryByText('THREAT NEUTRALIZED') !== null).toBe(true);
  });
}

async function winMission() {
  for (let i = 0; i < QUESTIONS_TO_WIN; i++) await answerQuestion();
  await screen.findByText('THREAT NEUTRALIZED');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('camera consent', () => {
  it('asks first, and does not touch the camera or start the mission until a choice is made', async () => {
    const server = installFakeServer();
    const { getUserMedia } = fakeCamera();
    renderMission();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: /enable camera/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue without camera/i })).toBeTruthy();
    expect(screen.getByText(/not a medical test/i)).toBeTruthy();
    expect(screen.getByText(/No pictures or video are saved or sent anywhere/i)).toBeTruthy();

    await pause(50);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(server.requests).toHaveLength(0);
  });

  it('remembers "continue without camera" and does not ask again', async () => {
    installFakeServer();
    const { getUserMedia } = fakeCamera();
    const first = renderMission();
    choose(/continue without camera/i);
    await screen.findByText(/^Question \d+$/);
    first.unmount();

    renderMission();
    await screen.findByText(/^Question \d+$/);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe('T1: playing without the camera', () => {
  it('wins a mission with attention sent as null on every answer', async () => {
    const server = installFakeServer();
    const { getUserMedia } = fakeCamera();
    renderMission();
    choose(/continue without camera/i);

    await winMission();

    expect(getUserMedia).not.toHaveBeenCalled();
    const answers = server.answers();
    expect(answers).toHaveLength(QUESTIONS_TO_WIN);
    for (const body of answers) expect(body.attention).toBeNull();
  });
});

describe('T2: playing with the camera', () => {
  it('sends a numeric summary with each answer', async () => {
    const server = installFakeServer();
    const { getUserMedia } = fakeCamera();
    renderMission();
    choose(/enable camera/i);
    await screen.findByRole('button', { name: /camera on/i });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect((getUserMedia.mock.calls as unknown[][])[0][0]).toMatchObject({ audio: false }); // video only, never sound

    await pause(350); // let a few readings arrive
    await answerQuestion();

    const attention = server.answers()[0].attention as Record<string, unknown>;
    expect(Object.keys(attention).sort()).toEqual(
      ['blink_rate_per_min', 'face_present_pct', 'on_screen_pct', 'sample_seconds'],
    );
    expect(attention.face_present_pct).toBe(100);
    expect(attention.on_screen_pct).toBe(100);
    expect(typeof attention.sample_seconds).toBe('number');
  });

  it('turns the camera on again next mission for a student who enabled it', async () => {
    installFakeServer();
    const { getUserMedia } = fakeCamera();
    localStorage.setItem(`mathverse_camera_choice_${USER_ID}`, 'enabled');
    renderMission();
    await screen.findByRole('button', { name: /camera on/i });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getUserMedia).toHaveBeenCalled();
  });
});

describe('T3: camera permission denied or camera missing', () => {
  it.each(['NotAllowedError', 'NotFoundError', 'NotReadableError'])(
    'carries on and can still win after %s',
    async (errorName) => {
      const server = installFakeServer();
      const { getUserMedia } = brokenCamera(errorName);
      renderMission();
      choose(/enable camera/i);

      expect(await screen.findByText(/Camera unavailable, carrying on without it/i)).toBeTruthy();
      await winMission();

      expect(getUserMedia).toHaveBeenCalledTimes(1); // asked once, no retry loop
      for (const body of server.answers()) expect(body.attention).toBeNull();
    },
  );

  it('carries on in a browser with no camera support at all', async () => {
    const server = installFakeServer();
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    renderMission();
    choose(/enable camera/i);

    expect(await screen.findByText(/Camera unavailable/i)).toBeTruthy();
    await winMission();
    for (const body of server.answers()) expect(body.attention).toBeNull();
  });

  it('does not ask again next mission after the camera failed', async () => {
    installFakeServer();
    brokenCamera('NotAllowedError');
    const first = renderMission();
    choose(/enable camera/i);
    await screen.findByText(/Camera unavailable/i);
    first.unmount();

    renderMission();
    await screen.findByText(/^Question \d+$/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('T4: switching the camera off during a mission', () => {
  it('stops the webcam at once and sends null from then on', async () => {
    const server = installFakeServer();
    const { track } = fakeCamera();
    renderMission();
    choose(/enable camera/i);
    await screen.findByRole('button', { name: /camera on/i });
    await pause(350);
    await answerQuestion(); // answered with the camera on

    choose(/camera on/i); // the HUD toggle
    expect(track.stop).toHaveBeenCalled();
    expect(closeDetector).toHaveBeenCalled();
    await screen.findByRole('button', { name: /camera off/i });

    await answerQuestion();
    await answerQuestion();
    await screen.findByText('THREAT NEUTRALIZED'); // the mission still finishes normally

    const answers = server.answers();
    expect(answers[0].attention).not.toBeNull(); // the earlier answer keeps its values
    expect(answers[1].attention).toBeNull();
    expect(answers[2].attention).toBeNull();
    expect(localStorage.getItem(`mathverse_camera_choice_${USER_ID}`)).toBe('declined');
  });

  it('stops the webcam when the student leaves the mission', async () => {
    installFakeServer();
    const { track } = fakeCamera();
    const view = renderMission();
    choose(/enable camera/i);
    await screen.findByRole('button', { name: /camera on/i });
    view.unmount();
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('the camera on the end screen', () => {
  it('is switched off when the mission ends, and comes back on for another try', async () => {
    installFakeServer();
    const { track, getUserMedia } = fakeCamera();
    const view = renderMission();
    choose(/enable camera/i);
    await screen.findByRole('button', { name: /camera on/i });

    await winMission();
    // Still on the victory screen: nothing has been unmounted.
    expect(view.container.isConnected).toBe(true);
    await waitFor(() => expect(track.stop).toHaveBeenCalled());
    expect(localStorage.getItem(`mathverse_camera_choice_${USER_ID}`)).toBe('enabled'); // the choice is kept

    fireEvent.click(screen.getAllByRole('button').find((b) => /again|replay|rematch/i.test(b.textContent ?? ''))!);
    await screen.findByRole('button', { name: /camera on/i });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});

describe('T5: no webcam images are uploaded', () => {
  it('sends only small JSON text, and never turns a frame into an image', async () => {
    const server = installFakeServer();
    fakeCamera();
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const createElement = vi.spyOn(document, 'createElement');

    renderMission();
    choose(/enable camera/i);
    await screen.findByRole('button', { name: /camera on/i });
    await pause(350);
    await winMission();

    // No frame was ever copied to a canvas or encoded as an image.
    expect(toDataURL).not.toHaveBeenCalled();
    expect(toBlob).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
    expect(createElement.mock.calls.some(([tag]) => String(tag).toLowerCase() === 'canvas')).toBe(false);

    expect(server.requests.length).toBeGreaterThan(QUESTIONS_TO_WIN);
    for (const request of server.requests) {
      // Every request goes to the app's own API and carries, at most, a short JSON string.
      expect(new URL(request.url).origin).toBe('http://localhost:8001');
      if (request.rawBody === undefined) continue;
      expect(typeof request.rawBody).toBe('string');
      const text = request.rawBody as string;
      expect(text.length).toBeLessThan(500);
      expect(text).not.toMatch(/data:image|base64|blob:|image\/|video\//i);
    }

    expect(server.answers()[0].attention).not.toBeNull();
    // The attention part of each answer is exactly four numbers.
    for (const body of server.answers()) {
      expect(Object.keys(body).sort()).toEqual(['attention', 'hint_used', 'response_time_ms', 'selected_index']);
      // null is allowed too: a question answered before any reading arrived is "not measured"
      for (const value of Object.values((body.attention ?? {}) as object)) {
        expect(value === null || typeof value === 'number').toBe(true);
      }
    }
  });
});
