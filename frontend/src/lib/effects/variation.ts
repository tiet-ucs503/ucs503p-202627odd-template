// Chooses which variation of an effect to use, so the same one is not heard or
// seen twice in a row when there is an alternative.

export interface Pickable {
  id: string;
  /**
   * How many other picks of this effect must happen before this variation may
   * be used again. For example 2 means "at most once in every three".
   */
  minGap?: number;
}

export type Rng = () => number; // returns a number from 0 (inclusive) to 1 (exclusive)

interface History {
  picks: number;
  lastId: string | null;
  lastUsedAt: Map<string, number>;
}

export class VariationPicker {
  private history = new Map<string, History>();

  constructor(private rng: Rng = Math.random) {}

  /**
   * Picks one option for the effect identified by `key`, or null if none is
   * allowed right now (every option is still inside its gap).
   */
  pick<T extends Pickable>(key: string, options: readonly T[]): T | null {
    let h = this.history.get(key);
    if (!h) {
      h = { picks: 0, lastId: null, lastUsedAt: new Map() };
      this.history.set(key, h);
    }
    const turn = h.picks;
    h.picks += 1;

    let allowed = options.filter((o) => {
      const usedAt = h.lastUsedAt.get(o.id);
      return usedAt === undefined || turn - usedAt > (o.minGap ?? 0);
    });
    if (allowed.length === 0) return null;
    if (allowed.length > 1) allowed = allowed.filter((o) => o.id !== h.lastId); // no immediate repeat

    const choice = allowed[Math.min(allowed.length - 1, Math.floor(this.rng() * allowed.length))];
    h.lastId = choice.id;
    h.lastUsedAt.set(choice.id, turn);
    return choice;
  }

  /** A small pitch change so repeated sounds are not identical: about plus or minus 6%. */
  pitchJitter(): number {
    return 1 + (this.rng() - 0.5) * 0.12;
  }

  /** A small start delay in milliseconds (0 to 40). */
  timingJitterMs(): number {
    return Math.round(this.rng() * 40);
  }
}
