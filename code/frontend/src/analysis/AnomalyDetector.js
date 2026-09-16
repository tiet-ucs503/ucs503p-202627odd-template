// Evaluates rep metrics against calibrated baselines using z-score anomaly detection.

export class AnomalyDetector {
  constructor({ zThreshold = 2.0 } = {}) {
    this.zThreshold = zThreshold;
    this.repHistory = [];
  }

  // Detects statistical anomalies in a rep compared to user baseline and set history.
  evaluateRep(repMetrics, baseline = null) {
    const anomalies = [];
    this.repHistory.push(repMetrics);

    // Baseline ROM anomaly check using z-score.
    if (baseline?.angleStats?.knee && repMetrics.romValue !== undefined) {
      const { mean, std } = baseline.angleStats.knee;
      if (std > 0) {
        const z = (repMetrics.romValue - mean) / std;
        if (Math.abs(z) >= this.zThreshold) {
          anomalies.push({
            type: "ROM_ANOMALY",
            zScore: Number(z.toFixed(2)),
            message: z < 0 ? "ROM significantly below calibrated baseline" : "ROM unusually high",
          });
        }
      }
    }

    // Fatigue detection across consecutive reps.
    if (this.repHistory.length >= 3) {
      const recent = this.repHistory.slice(-3);
      const declining = recent[0].romValue > recent[1].romValue && recent[1].romValue > recent[2].romValue;
      const tempoDrop = recent[2].tempo > recent[0].tempo * 1.5;
      if (declining && tempoDrop) {
        anomalies.push({
          type: "FATIGUE_DETECTED",
          message: "Fatigue detected: declining range of motion and slowed tempo",
        });
      }
    }

    return {
      hasAnomaly: anomalies.length > 0,
      anomalies,
    };
  }

  // Resets set history.
  reset() {
    this.repHistory = [];
  }
}
