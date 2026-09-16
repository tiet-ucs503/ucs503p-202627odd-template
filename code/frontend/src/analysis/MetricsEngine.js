// Calculates temporal and kinematic metrics for completed reps.
export class MetricsEngine {
  // Computes duration, ROM delta, and tempo for a completed rep.
  compute(rep) {
    const durationSeconds = (rep.endMs - rep.startMs) / 1000;
    const descentSeconds = (rep.bottomMs - rep.startMs) / 1000;
    const ascentSeconds = (rep.endMs - rep.bottomMs) / 1000;
    const romValue = rep.peakAngleDeg - rep.minAngleDeg;

    return {
      repNumber: rep.repNumber,
      durationSeconds,
      romValue,
      tempo: descentSeconds / ascentSeconds,
      angleMetrics: {
        minAngle: rep.minAngleDeg,
        peakAngle: rep.peakAngleDeg,
      },
    };
  }
}
