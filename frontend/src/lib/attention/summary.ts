// Turns a stream of face samples into one small numeric summary per question.
//
// What this measures: was a face in front of the camera, and was the head
// roughly facing the screen. It is an estimate, not eye tracking and not a
// medical assessment, and nothing academic ever reads it.

import type { AttentionSummary } from '@/lib/api';

/** One reading from the face detector. Numbers only; no image data. */
export interface FaceSample {
  facePresent: boolean;
  /** Head turn left/right in degrees (0 = straight at the camera). */
  yawDeg: number;
  /** Head tilt up/down in degrees. */
  pitchDeg: number;
  eyesClosed: boolean;
}

/** The first seconds with a face visible set what "facing the screen" looks like for this student. */
export const CALIBRATION_MS = 5000;
/** How far the head may turn from that baseline and still count as facing the screen. */
export const YAW_LIMIT_DEG = 25;
export const PITCH_LIMIT_DEG = 20;
/** Below this, a blink rate would be noise, so it is reported as "not measured". */
const MIN_SECONDS_FOR_BLINK_RATE = 5;
const MAX_BLINK_RATE = 200;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface HeadBaseline {
  yaw: number;
  pitch: number;
}

/** Is the head within the allowed turn and tilt of the student's own resting position? */
export function isFacingScreen(sample: FaceSample, baseline: HeadBaseline): boolean {
  return (
    Math.abs(sample.yawDeg - baseline.yaw) <= YAW_LIMIT_DEG &&
    Math.abs(sample.pitchDeg - baseline.pitch) <= PITCH_LIMIT_DEG
  );
}

export class AttentionAccumulator {
  // Baseline head pose: learned once, kept for the whole mission.
  private baseline: { yaw: number; pitch: number } | null = null;
  private calibrationStart: number | null = null;
  private calibrationSamples: { yaw: number; pitch: number }[] = [];

  // Counters for the current question.
  private total = 0;
  private present = 0;
  private onScreen = 0;
  private blinks = 0;
  private firstAt: number | null = null;
  private lastAt = 0;
  private eyesWereClosed = false;

  add(sample: FaceSample, timeMs: number): void {
    this.total += 1;
    if (this.firstAt === null) this.firstAt = timeMs;
    this.lastAt = timeMs;

    if (!sample.facePresent) {
      this.eyesWereClosed = false;
      return;
    }
    this.present += 1;

    // A blink is eyes closed followed by eyes open again.
    if (this.eyesWereClosed && !sample.eyesClosed) this.blinks += 1;
    this.eyesWereClosed = sample.eyesClosed;

    if (this.baseline === null) {
      // Still calibrating: the student has just started and is reading the
      // question, so a visible face counts as facing the screen.
      if (this.calibrationStart === null) this.calibrationStart = timeMs;
      this.calibrationSamples.push({ yaw: sample.yawDeg, pitch: sample.pitchDeg });
      this.onScreen += 1;
      if (timeMs - this.calibrationStart >= CALIBRATION_MS) {
        const n = this.calibrationSamples.length;
        this.baseline = {
          yaw: this.calibrationSamples.reduce((s, c) => s + c.yaw, 0) / n,
          pitch: this.calibrationSamples.reduce((s, c) => s + c.pitch, 0) / n,
        };
        this.calibrationSamples = [];
      }
      return;
    }

    if (isFacingScreen(sample, this.baseline)) this.onScreen += 1;
  }

  /** For the test readout only: where calibration stands. Reading it changes nothing. */
  calibration(nowMs: number): { baseline: HeadBaseline | null; msLeft: number } {
    if (this.baseline) return { baseline: { ...this.baseline }, msLeft: 0 };
    const elapsed = this.calibrationStart === null ? 0 : nowMs - this.calibrationStart;
    return { baseline: null, msLeft: Math.max(0, CALIBRATION_MS - elapsed) };
  }

  /** Clears the per-question counters. The calibrated baseline is kept. */
  resetQuestion(): void {
    this.total = 0;
    this.present = 0;
    this.onScreen = 0;
    this.blinks = 0;
    this.firstAt = null;
    this.lastAt = 0;
    this.eyesWereClosed = false;
  }

  /** The summary for the current question, or null if nothing was measured. */
  summary(): AttentionSummary | null {
    if (this.total === 0 || this.firstAt === null) return null;
    const seconds = (this.lastAt - this.firstAt) / 1000;
    return {
      face_present_pct: round1((100 * this.present) / this.total),
      on_screen_pct: round1((100 * this.onScreen) / this.total),
      blink_rate_per_min:
        seconds >= MIN_SECONDS_FOR_BLINK_RATE
          ? Math.min(MAX_BLINK_RATE, round1(this.blinks / (seconds / 60)))
          : null,
      sample_seconds: round1(seconds),
    };
  }
}
