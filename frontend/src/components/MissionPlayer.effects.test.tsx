// Sound and motion settings must hold their values all the way through play:
// across questions, a restarted mission, a different villain, and a reload.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MissionPlayer from '@/components/MissionPlayer';
import { effectsSettings } from '@/lib/effects/settings';
import { installFakeServer, QUESTIONS_TO_WIN } from '@/test/fakeServer';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, name: 'Tester', role: 'student', is_demo: false } }),
}));
vi.mock('@/context/GameContext', () => ({
  useGame: () => ({
    progress: { points: 0, level: 1, unlocked_bosses: ['goblin', 'doc-ock'], missions_won: 0, link_code: null },
    setProgress: vi.fn(),
  }),
}));
vi.mock('@/lib/attention/detector', () => ({ createFaceDetector: vi.fn() }));

const CHOSEN = { muted: true, volume: 35, motion: 'reduced' as const };

const renderMission = (bossId = 'goblin') =>
  render(<MissionPlayer bossId={bossId} onExit={vi.fn()} feedbackMs={20} />);

async function answerQuestion() {
  const shown = (await screen.findByText(/^Puzzle \d+$/)).textContent;
  fireEvent.click(screen.getByRole('button', { name: /^A\s*1$/ }));
  await waitFor(() => {
    const now = screen.queryByText(/^Puzzle \d+$/)?.textContent;
    expect(now !== shown || screen.queryByText('THREAT NEUTRALIZED') !== null).toBe(true);
  });
}

/** Sets mute, volume and reduced motion using the on-screen controls, as a player would. */
async function chooseSettings() {
  await screen.findByText(/^Puzzle \d+$/);
  fireEvent.click(await screen.findByRole('button', { name: /turn sound off/i }));
  fireEvent.click(await screen.findByRole('button', { name: /turn sound on/i })); // unmute to move the slider
  fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '35' } });
  fireEvent.click(await screen.findByRole('button', { name: /turn sound off/i }));
  fireEvent.click(screen.getByRole('checkbox', { name: /less motion/i }));
  await waitFor(() => expect(effectsSettings.get()).toEqual(CHOSEN));
}

function expectControlsToShow() {
  expect(screen.getByRole('button', { name: /sound is off/i }).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement).value).toBe('35');
  expect((screen.getByRole('checkbox', { name: /less motion/i }) as HTMLInputElement).checked).toBe(true);
}

beforeEach(() => {
  localStorage.setItem('mathverse_camera_choice_7', 'declined'); // skip the camera question
  effectsSettings.reload(); // start each test as a fresh page load would
});

describe('sound and motion settings', () => {
  it('keep their values across questions, a restart, another villain and a reload', async () => {
    installFakeServer();
    const first = renderMission('goblin');
    await chooseSettings();
    const update = vi.spyOn(effectsSettings, 'update');

    // Across questions, through to the end of the mission.
    for (let i = 0; i < QUESTIONS_TO_WIN; i++) {
      await answerQuestion();
      expect(effectsSettings.get()).toEqual(CHOSEN);
    }
    await screen.findByText('THREAT NEUTRALIZED');

    // Restarting the same mission.
    fireEvent.click(screen.getByRole('button', { name: 'PLAY AGAIN' }));
    await screen.findByText(/^Puzzle \d+$/);
    expect(effectsSettings.get()).toEqual(CHOSEN);
    expectControlsToShow();
    await answerQuestion();

    // Leaving, then fighting a different villain.
    first.unmount();
    const second = renderMission('doc-ock');
    await screen.findByText(/^Puzzle \d+$/);
    expect(effectsSettings.get()).toEqual(CHOSEN);
    expectControlsToShow();
    await answerQuestion();
    second.unmount();

    // Nothing in the game wrote to the settings: only the controls ever do.
    expect(update).not.toHaveBeenCalled();

    // A page reload reads the same values back from the device.
    effectsSettings.reload();
    expect(effectsSettings.get()).toEqual(CHOSEN);
    renderMission('goblin');
    await screen.findByText(/^Puzzle \d+$/);
    expectControlsToShow();
  });

  it('are stored on the device under one key', async () => {
    installFakeServer();
    renderMission();
    await chooseSettings();
    expect(JSON.parse(localStorage.getItem('mathverse_effects_settings')!)).toEqual(CHOSEN);
  });

  it('the controls sit in the mission bar and never cover the question', async () => {
    installFakeServer();
    renderMission();
    const question = await screen.findByText(/^Puzzle \d+$/);
    const controls = screen.getByRole('group', { name: /sound and motion settings/i });
    expect(controls.contains(question)).toBe(false);
    expect(question.closest('[role=group]')).toBeNull();
  });
});

describe('mission sound', () => {
  it('still completes a mission with no audio system available', async () => {
    installFakeServer(); // jsdom has no AudioContext: the engine must stay silent, not fail
    renderMission();
    for (let i = 0; i < QUESTIONS_TO_WIN; i++) await answerQuestion();
    expect(await screen.findByText('THREAT NEUTRALIZED')).toBeTruthy();
  });

  it('has no audio tags or direct audio code left in the mission screen', async () => {
    installFakeServer();
    const view = renderMission();
    await screen.findByText(/^Puzzle \d+$/);
    expect(view.container.querySelectorAll('audio')).toHaveLength(0);
    const source = (await import('@/components/MissionPlayer.tsx?raw')).default as string;
    expect(source).not.toMatch(/new AudioContext|<audio|\.play\(\)\.catch/);
  });
});
