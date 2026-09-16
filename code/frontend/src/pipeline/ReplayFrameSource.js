// Replays recorded landmark fixtures frame-by-frame.
export class ReplayFrameSource {
  constructor(fixtureJson) {
    if (!fixtureJson || !Array.isArray(fixtureJson.frames)) {
      throw new Error("ReplayFrameSource: fixtureJson.frames must be an array");
    }
    this._frames = fixtureJson.frames;
    this._index = 0;
  }

  // Returns true if there are more frames left to replay.
  hasNext() {
    return this._index < this._frames.length;
  }

  // Returns the next frame, or null when finished.
  next() {
    if (this._index >= this._frames.length) return null;
    const frame = this._frames[this._index];
    this._index += 1;
    return {
      landmarks: Array.isArray(frame.landmarks) ? frame.landmarks.slice() : [],
      timestampMs: frame.t,
    };
  }

  // Resets playback index to the start.
  reset() {
    this._index = 0;
  }
}
