// The only file that touches MediaPipe. It runs the face model inside the
// browser (WebAssembly) and returns a few numbers per video frame. The frame
// itself never leaves this function: it is not stored, drawn or sent anywhere.
//
// The model and the WebAssembly runtime are served by this app itself.
//
// MediaPipe also tries to post a small usage log (no image) to a Google
// address, and offers no way to switch that off. The page's connection rule in
// vite.config.ts makes the browser refuse it, so nothing reaches a third party.
// scripts/camera-check.mjs checks this in a real browser.

import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import type { FaceSample } from '@/lib/attention/summary';

const MODEL_URL = '/models/face_landmarker.task';
const EYES_CLOSED_SCORE = 0.5;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export interface FaceDetector {
  /** Reads the current video frame. Returns null if no new frame is available yet. */
  detect(video: HTMLVideoElement, timeMs: number): FaceSample | null;
  close(): void;
}

/** Head yaw and pitch, in degrees, from MediaPipe's 4x4 face transformation matrix. */
export function headAngles(matrix: number[]): { yawDeg: number; pitchDeg: number } {
  // Column-major 4x4: element (row r, column c) is matrix[c * 4 + r].
  const r02 = matrix[8];
  const r12 = matrix[9];
  const r22 = matrix[10];
  return {
    yawDeg: toDegrees(Math.atan2(r02, r22)),
    pitchDeg: toDegrees(Math.asin(Math.max(-1, Math.min(1, -r12)))),
  };
}

export async function createFaceDetector(): Promise<FaceDetector> {
  // Loaded on demand, so students who never enable the camera never download it.
  const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
  const landmarker: FaceLandmarker = await FaceLandmarker.createFromOptions(
    { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl },
    {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    },
  );

  let lastVideoTime = -1;

  return {
    detect(video, timeMs) {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return null;
      lastVideoTime = video.currentTime;

      const result = landmarker.detectForVideo(video, timeMs);
      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      if (!result.faceLandmarks?.length || !matrix) {
        return { facePresent: false, yawDeg: 0, pitchDeg: 0, eyesClosed: false };
      }

      const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
      const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
      return {
        facePresent: true,
        ...headAngles(matrix),
        eyesClosed: score('eyeBlinkLeft') > EYES_CLOSED_SCORE && score('eyeBlinkRight') > EYES_CLOSED_SCORE,
      };
    },
    close() {
      landmarker.close();
    },
  };
}
