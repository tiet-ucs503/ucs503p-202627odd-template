import { describe, expect, it } from 'vitest';
import { AttentionAccumulator, CALIBRATION_MS, FaceSample } from '@/lib/attention/summary';
import { headAngles } from '@/lib/attention/detector';

const facing: FaceSample = { facePresent: true, yawDeg: 0, pitchDeg: 0, eyesClosed: false };
const lookingAway: FaceSample = { ...facing, yawDeg: 50 };
const noFace: FaceSample = { facePresent: false, yawDeg: 0, pitchDeg: 0, eyesClosed: false };

/** Feeds one sample every 100 ms. Returns the time after the last one. */
function feed(acc: AttentionAccumulator, sample: FaceSample, count: number, startMs: number) {
  for (let i = 0; i < count; i++) acc.add(sample, startMs + i * 100);
  return startMs + count * 100;
}

function calibrated() {
  const acc = new AttentionAccumulator();
  const t = feed(acc, facing, CALIBRATION_MS / 100 + 1, 0);
  acc.resetQuestion();
  return { acc, t };
}

describe('AttentionAccumulator', () => {
  it('reports nothing when nothing was measured', () => {
    expect(new AttentionAccumulator().summary()).toBeNull();
  });

  it('counts a student facing the screen as fully on screen', () => {
    const { acc, t } = calibrated();
    feed(acc, facing, 100, t);
    expect(acc.summary()).toMatchObject({ face_present_pct: 100, on_screen_pct: 100, sample_seconds: 9.9 });
  });

  it('counts time looking away as off screen, with the face still present', () => {
    const { acc, t } = calibrated();
    const t2 = feed(acc, facing, 50, t);
    feed(acc, lookingAway, 50, t2);
    expect(acc.summary()).toMatchObject({ face_present_pct: 100, on_screen_pct: 50 });
  });

  it('counts an empty chair as neither present nor on screen', () => {
    const { acc, t } = calibrated();
    feed(acc, noFace, 40, t);
    expect(acc.summary()).toMatchObject({ face_present_pct: 0, on_screen_pct: 0 });
  });

  it('measures against the student\'s own resting head position', () => {
    // Someone whose camera sits off to one side always appears turned by 20 degrees.
    const offset: FaceSample = { ...facing, yawDeg: 20 };
    const acc = new AttentionAccumulator();
    const t = feed(acc, offset, CALIBRATION_MS / 100 + 1, 0);
    acc.resetQuestion();
    const t2 = feed(acc, { ...facing, yawDeg: 35 }, 10, t); // 15 degrees from their baseline: fine
    feed(acc, { ...facing, yawDeg: 60 }, 10, t2); // 40 degrees from their baseline: away
    expect(acc.summary()?.on_screen_pct).toBe(50);
  });

  it('treats a visible face as on screen while still calibrating', () => {
    const acc = new AttentionAccumulator();
    feed(acc, lookingAway, 20, 0);
    expect(acc.summary()?.on_screen_pct).toBe(100);
  });

  it('counts blinks and reports them per minute', () => {
    const { acc, t } = calibrated();
    let now = t;
    for (let blink = 0; blink < 5; blink++) {
      now = feed(acc, facing, 19, now);
      now = feed(acc, { ...facing, eyesClosed: true }, 1, now);
    }
    feed(acc, facing, 1, now); // eyes open again after the last blink
    const summary = acc.summary()!;
    expect(summary.sample_seconds).toBe(10);
    expect(summary.blink_rate_per_min).toBe(30); // 5 blinks in 10 seconds
  });

  it('reports no blink rate, rather than zero, when no face was seen', () => {
    const acc = new AttentionAccumulator();
    feed(acc, noFace, 100, 0); // ten seconds of an empty chair
    expect(acc.summary()).toMatchObject({ face_present_pct: 0, on_screen_pct: 0, blink_rate_per_min: null });
  });

  it('does not report a blink rate from a very short sample', () => {
    const { acc, t } = calibrated();
    feed(acc, facing, 10, t);
    expect(acc.summary()?.blink_rate_per_min).toBeNull();
  });

  it('starts each question from zero but keeps the calibration', () => {
    const { acc, t } = calibrated();
    const t2 = feed(acc, lookingAway, 30, t);
    acc.resetQuestion();
    expect(acc.summary()).toBeNull();
    feed(acc, lookingAway, 10, t2);
    expect(acc.summary()?.on_screen_pct).toBe(0); // still judged against the baseline
  });
});

describe('headAngles', () => {
  const rotationY = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    // Column-major 4x4 rotation about the vertical axis.
    return [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
  };

  it('reads zero for a face looking straight ahead', () => {
    const { yawDeg, pitchDeg } = headAngles(rotationY(0));
    expect(yawDeg).toBeCloseTo(0);
    expect(pitchDeg).toBeCloseTo(0);
  });

  it('reads the turn angle for a turned head', () => {
    expect(headAngles(rotationY(30)).yawDeg).toBeCloseTo(30);
    expect(headAngles(rotationY(-40)).yawDeg).toBeCloseTo(-40);
  });
});
