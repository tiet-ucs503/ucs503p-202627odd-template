// The visual side of battle effects: where they appear, what they may cover,
// and what happens when reduced motion is on.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MissionPlayer from '@/components/MissionPlayer';
import { CUES, cueClass, MAX_OVERLAY_COVER_PCT, MAX_OVERLAY_MS, MAX_PARTICLES } from '@/lib/effects/cues';
import { SHARED, SPIDERMAN, VILLAINS } from '@/lib/effects/profiles';
import { effectsSettings } from '@/lib/effects/settings';
import { VILLAIN_CHARACTERS } from '@/lib/characters';
import effectsCss from '@/styles/effects.css?raw';
import { installFakeServer } from '@/test/fakeServer';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, name: 'Tester', role: 'student', is_demo: false } }),
}));
vi.mock('@/context/GameContext', () => ({
  useGame: () => ({
    progress: { points: 0, level: 1, unlocked_bosses: Object.keys(VILLAIN_CHARACTERS), missions_won: 0, link_code: null },
    setProgress: vi.fn(),
  }),
}));
vi.mock('@/lib/attention/detector', () => ({ createFaceDetector: vi.fn() }));

// A long pause after each answer, so the effects are still on screen when the test looks.
const renderMission = (bossId = 'goblin') =>
  render(<MissionPlayer bossId={bossId} onExit={vi.fn()} feedbackMs={5000} />);
const option = () => screen.getByRole('button', { name: /^A\s*1$/ });
const cuesOnScreen = (view: { container: HTMLElement }) =>
  [...view.container.querySelectorAll('[data-cue]')].map((el) => el.getAttribute('data-cue'));

beforeEach(() => {
  localStorage.setItem('mathverse_camera_choice_7', 'declined');
  effectsSettings.reload();
});

describe('character portraits', () => {
  it.each(Object.values(VILLAIN_CHARACTERS))('$name shows its own animated image, not a placeholder', async (villain) => {
    installFakeServer();
    const view = renderMission(villain.id);
    await screen.findByText(/^Puzzle \d+$/);
    const portrait = view.container.querySelector(`[data-portrait="${villain.id}"] img`) as HTMLImageElement;
    expect(portrait.getAttribute('src')).toBe(villain.image);
    expect(view.container.querySelector('[data-portrait="spiderman"] img')).not.toBeNull();
  });

  it('every villain has different artwork', () => {
    const images = Object.values(VILLAIN_CHARACTERS).map((v) => v.image);
    expect(new Set(images).size).toBe(6);
  });
});

describe('a strike by Spider-Man', () => {
  it('draws a web across the lane and makes the villain portrait react', async () => {
    installFakeServer();
    const view = renderMission('venom'); // a villain still using the shared effects
    await screen.findByText(/^Puzzle \d+$/);
    fireEvent.click(option());

    await waitFor(() => expect(cuesOnScreen(view).some((c) => c?.startsWith('web-line'))).toBe(true));
    await waitFor(() => expect(cuesOnScreen(view).some((c) => c?.startsWith('web-splat'))).toBe(true));
    const frame = view.container.querySelector('[data-portrait="venom"] [data-portrait-frame]')!;
    await waitFor(() => expect(frame.className).toContain('fx-react-recoil'));

    // The reaction is on the portrait itself, and the image is still there.
    expect(frame.querySelector('img')).not.toBeNull();
  });

  it('cleans up: every cue is gone once its time is up', async () => {
    installFakeServer();
    const view = renderMission();
    await screen.findByText(/^Puzzle \d+$/);
    fireEvent.click(option());
    await waitFor(() => expect(cuesOnScreen(view).length).toBeGreaterThan(0));
    await waitFor(() => expect(cuesOnScreen(view)).toHaveLength(0), { timeout: 2000 });
    const frame = view.container.querySelector('[data-portrait="goblin"] [data-portrait-frame]')!;
    expect(frame.className).not.toContain('fx-react');
  });
});

describe('each villain takes a hit in its own way', () => {
  it.each([
    ['goblin', 'fx-react-wobble'],
    ['doc-ock', 'fx-react-flinch'],
    ['mysterio', 'fx-react-ripple'],
  ])('%s: its portrait shows %s, and the web still lands', async (villainId, reaction) => {
    installFakeServer();
    const view = renderMission(villainId);
    await screen.findByText(/^Puzzle \d+$/);
    fireEvent.click(option());

    const frame = view.container.querySelector(`[data-portrait="${villainId}"] [data-portrait-frame]`)!;
    await waitFor(() => expect(frame.className).toContain(reaction));
    expect(frame.className).not.toContain('fx-react-recoil');
    expect(frame.querySelector('img')).not.toBeNull(); // the animated image is still there
    expect(cuesOnScreen(view).some((c) => c?.startsWith('web-'))).toBe(true);
  });

  it('Mysterio enters with mist and ghost copies of his own image', async () => {
    installFakeServer();
    const view = renderMission('mysterio');
    await screen.findByText(/^Puzzle \d+$/);
    await waitFor(() => expect(cuesOnScreen(view).some((c) => c?.startsWith('mysterio-mist'))).toBe(true));
    await waitFor(() => expect(cuesOnScreen(view).some((c) => c?.startsWith('mysterio-ghost'))).toBe(true));
    const ghost = view.container.querySelector('[data-cue^="mysterio-ghost"]') as HTMLImageElement;
    expect(ghost.getAttribute('src')).toBe(VILLAIN_CHARACTERS.mysterio.image);
    // The ghost is in the lane, not on top of the real portrait.
    expect(view.container.querySelector('[data-effects-lane]')!.contains(ghost)).toBe(true);
    expect(view.container.querySelector('[data-portrait="mysterio"]')!.contains(ghost)).toBe(false);
  });

  it('Doctor Octopus enters by unfolding his arms into the lane', async () => {
    installFakeServer();
    const view = renderMission('doc-ock');
    await screen.findByText(/^Puzzle \d+$/);
    await waitFor(() => expect(cuesOnScreen(view).filter((c) => c?.startsWith('ock-arm')).length).toBeGreaterThanOrEqual(1));
    expect(view.container.querySelector('[data-effects-lane] svg path')).not.toBeNull();
  });
});

describe('effects never get in the way', () => {
  it('the effects layer ignores the mouse, is hidden from screen readers, and sits in the header only', async () => {
    installFakeServer();
    const view = renderMission();
    const question = await screen.findByText(/^Puzzle \d+$/);
    const layer = view.container.querySelector('[data-effects-layer]')!;
    expect(layer.className).toContain('pointer-events-none');
    expect(layer.getAttribute('aria-hidden')).toBe('true');

    // The layer lives inside the battle header; the question and options are outside it.
    const header = layer.parentElement!;
    expect(header.contains(view.container.querySelector('[data-portrait="spiderman"]'))).toBe(true);
    expect(header.contains(question)).toBe(false);
    expect(header.contains(option())).toBe(false);
    expect(header.contains(screen.getByRole('group', { name: /sound and motion settings/i }))).toBe(false);
    expect(header.contains(screen.getByRole('button', { name: /ask gwen/i }))).toBe(false);
  });

  it('the result banner has its own row and is not inside the question panel', async () => {
    installFakeServer();
    const view = renderMission();
    const question = await screen.findByText(/^Puzzle \d+$/);
    fireEvent.click(option());
    const banner = await screen.findByText(/WEB STRIKE!/);
    const strip = view.container.querySelector('[data-result-strip]')!;
    expect(strip.contains(banner)).toBe(true);
    expect(strip.contains(question)).toBe(false);
    expect(strip.className).toContain('h-10'); // fixed height: the question does not jump when it appears
    // The question and its options are still on screen behind nothing.
    expect(screen.getByText(/^Puzzle \d+$/)).toBeTruthy();
    expect(view.container.querySelector('.backdrop-blur-sm.absolute.inset-0')).toBeNull();
  });

  it('overlays stay small and brief, so a portrait is never hidden', () => {
    const profiles = [SHARED, SPIDERMAN, ...Object.values(VILLAINS)];
    for (const profile of profiles) {
      for (const variation of Object.values(profile).flat()) {
        for (const step of variation.cues) {
          const def = CUES[step.cue];
          expect(def, `unknown cue ${step.cue}`).toBeDefined();
          if (def.kind === 'overlay' && (step.target === 'player' || step.target === 'villain')) {
            expect(def.coverPct).toBeLessThanOrEqual(MAX_OVERLAY_COVER_PCT);
            expect(step.durMs).toBeLessThanOrEqual(MAX_OVERLAY_MS);
          }
          if (def.particles) expect(def.particles).toBeLessThanOrEqual(MAX_PARTICLES);
          expect(step.atMs + step.durMs).toBeLessThanOrEqual(2200); // fits in the pause between questions
        }
      }
    }
  });
});

describe('reduced motion', () => {
  it('replaces movement with fades and drops the particles', async () => {
    effectsSettings.update({ motion: 'reduced' });
    installFakeServer();
    const view = renderMission();
    await screen.findByText(/^Puzzle \d+$/);
    fireEvent.click(option());

    await waitFor(() => expect(cuesOnScreen(view).some((c) => c?.startsWith('web-line'))).toBe(true));
    await waitFor(() => expect(cuesOnScreen(view).some((c) => c?.startsWith('web-splat'))).toBe(true));
    const classes = [...view.container.querySelectorAll('[data-cue]')].map((el) => el.className).join(' ');
    expect(classes).not.toMatch(/-moving/);
    expect(classes).toMatch(/-still/);
    expect(cuesOnScreen(view)).not.toContain('spark-burst');

    const frame = view.container.querySelector('[data-portrait="goblin"] [data-portrait-frame]')!;
    await waitFor(() => expect(frame.className).toContain('fx-react-dim'));
    expect(frame.className).not.toContain('fx-react-recoil');
  });

  it('every cue has a still form that does not move, or is left out', () => {
    // Collect the keyframes each class uses, then check the still ones never set a transform.
    const keyframes = new Map<string, string>();
    for (const m of effectsCss.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) keyframes.set(m[1], m[2]);
    expect(keyframes.size).toBeGreaterThan(8); // the stylesheet really was read
    const animationOf = (cls: string) => effectsCss.match(new RegExp(`\\.${cls}\\s*\\{[^}]*animation:\\s*([\\w-]+)`))?.[1];

    for (const [name, def] of Object.entries(CUES)) {
      if (def.reducedClassName === null) continue;
      expect(cueClass(name, true)).toBe(def.reducedClassName);
      for (const cls of def.reducedClassName.split(' ')) {
        const animation = animationOf(cls);
        if (animation) expect(keyframes.get(animation), `${name} → ${cls}`).not.toMatch(/transform/);
      }
    }
  });
});

describe('the effects stylesheet', () => {
  it('keeps every movement small and has no infinite or flashing animations', () => {
    expect(effectsCss.length).toBeGreaterThan(1000); // the stylesheet really was read
    expect(effectsCss).not.toMatch(/infinite/);
    for (const px of [...effectsCss.matchAll(/translate[XY]?\(calc\((-?\d+)px/g)].map((m) => Math.abs(Number(m[1])))) {
      expect(px).toBeLessThanOrEqual(24); // 24px is the entrance slide; hits and recoils are 6px or less
    }
    const shake = effectsCss.match(/@keyframes fx-hit[\s\S]*?\n}/)![0];
    for (const px of [...shake.matchAll(/calc\((-?\d+)px/g)].map((m) => Math.abs(Number(m[1])))) {
      expect(px).toBeLessThanOrEqual(4);
    }
  });
});
