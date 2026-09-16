import { describe, it, expect } from "vitest";
import { AnalysisPipeline } from "../pipeline/AnalysisPipeline.js";
import { LANDMARK_COUNT, POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

function makeMockLandmarks(angles = { left: 180, right: 180 }) {
    // Array of 33 landmarks
    const landmarks = new Array(LANDMARK_COUNT).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));

    // Helper to set points for a given angle at a knee
    // Using simple geometry: Knee at 0,0, Hip at (0, y), Ankle at (x, 0)
    // Angle = 90 deg -> Hip (0, 1), Knee (0,0), Ankle (1,0)
    // This is hard to do generically.
    // Instead, just set fixed coordinates for standing (180deg) and bent (90deg)

    // Standing (180 deg knee)
    // Hip (0, 2), Knee (0, 1), Ankle (0, 0) -> Straight line
    const setLeg = (side, angleDeg) => {
        const hipIdx = side === 'left' ? POSE_LANDMARKS.LEFT_HIP : POSE_LANDMARKS.RIGHT_HIP;
        const kneeIdx = side === 'left' ? POSE_LANDMARKS.LEFT_KNEE : POSE_LANDMARKS.RIGHT_KNEE;
        const ankleIdx = side === 'left' ? POSE_LANDMARKS.LEFT_ANKLE : POSE_LANDMARKS.RIGHT_ANKLE;

        if (angleDeg === 180) {
            landmarks[hipIdx] = { x: 0, y: 2, z: 0, visibility: 1 };
            landmarks[kneeIdx] = { x: 0, y: 1, z: 0, visibility: 1 };
            landmarks[ankleIdx] = { x: 0, y: 0, z: 0, visibility: 1 };
        } else if (angleDeg === 90) {
            landmarks[hipIdx] = { x: 0, y: 1, z: 0, visibility: 1 };
            landmarks[kneeIdx] = { x: 0, y: 0, z: 0, visibility: 1 };
            landmarks[ankleIdx] = { x: 1, y: 0, z: 0, visibility: 1 };
        }
    };

    setLeg('left', angles.left);
    setLeg('right', angles.right);

    return landmarks;
}

describe("AnalysisPipeline Integration", () => {
  it("advances state when valid squat sequence is processed", () => {
    const pipeline = new AnalysisPipeline();

    // Standing (180 deg)
    for (let i = 0; i < 5; i++) {
        pipeline.processFrame(makeMockLandmarks({ left: 180, right: 180 }), i * 33);
    }
    expect(pipeline.machine.state).toBe("STANDING");

    // Simulate descent (bending to 90 deg)
    for (let i = 0; i < 5; i++) {
        pipeline.processFrame(makeMockLandmarks({ left: 90, right: 90 }), (i+5) * 33);
    }

    // Expect transition to DESCENDING then BOTTOM
    // The machine might still be in DESCENDING or BOTTOM depending on frame count,
    // but definitely not STANDING anymore.
    expect(pipeline.machine.state).not.toBe("STANDING");
  });
});
