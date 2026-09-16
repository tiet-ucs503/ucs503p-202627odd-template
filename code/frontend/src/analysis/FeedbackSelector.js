// Prioritizes and debounces coaching feedback cues.
export class FeedbackSelector {
  constructor(debounceMs = 1500) {
    this.debounceMs = debounceMs;
    this.lastCue = null;
    this.lastSeverity = null;
    this.lastUpdate = 0;
  }

  // Selects highest-priority cue honoring debounce duration.
  select(ruleResults) {
    const now = Date.now();
    const failedRules = ruleResults.filter((r) => !r.pass);
    const severityMap = { high: 3, medium: 2, low: 1 };
    failedRules.sort((a, b) => severityMap[b.severity] - severityMap[a.severity]);

    const highestPriority = failedRules[0];

    if (!highestPriority) {
      if (now - this.lastUpdate > this.debounceMs) {
        this.lastCue = null;
        this.lastSeverity = null;
        return { activeCue: null, severity: null };
      }
      return { activeCue: this.lastCue, severity: this.lastSeverity };
    }

    if (highestPriority.cue === this.lastCue || now - this.lastUpdate > this.debounceMs) {
      this.lastCue = highestPriority.cue;
      this.lastSeverity = highestPriority.severity;
      this.lastUpdate = now;
    }

    return { activeCue: this.lastCue, severity: this.lastSeverity };
  }

  // Resets debounced feedback state.
  reset() {
    this.lastCue = null;
    this.lastSeverity = null;
    this.lastUpdate = 0;
  }
}
