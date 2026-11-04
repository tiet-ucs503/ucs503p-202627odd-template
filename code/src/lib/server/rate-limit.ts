/**
 * A small per-key sliding-window rate limiter.
 *
 * Why it exists: every Travis message costs a model call, and the only gate
 * on the route is "signed in". Anyone with an account could otherwise hold
 * the Groq quota open in a loop. This puts a ceiling on one person without
 * getting in the way of a real conversation.
 *
 * What it is not: a distributed limiter. State lives in this process's memory,
 * so on a serverless host each instance counts separately and a cold start
 * resets the count. That makes it best-effort protection against runaway
 * loops and casual abuse, not a guarantee — and the cost of being wrong is
 * bounded by the model provider's own quota. A hard guarantee would need a
 * shared store (Redis, Firestore), which this project deliberately doesn't
 * have a server tier for.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Records one attempt for `key` and says whether it is allowed. */
  check(key: string): RateLimitResult;
}

export function createRateLimiter(options: {
  /** Attempts allowed per window. */
  limit: number;
  windowMs: number;
  /** Injectable clock for tests. */
  now?: () => number;
}): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const attempts = new Map<string, number[]>();

  // Without this the map would grow by one entry per distinct user, forever.
  function sweep(at: number) {
    for (const [key, times] of attempts) {
      if (times.length === 0 || at - times[times.length - 1] >= windowMs) attempts.delete(key);
    }
  }

  return {
    check(key) {
      const at = now();
      const recent = (attempts.get(key) ?? []).filter((time) => at - time < windowMs);

      if (recent.length >= limit) {
        attempts.set(key, recent);
        // Free again once the oldest attempt in the window ages out.
        const retryAfterMs = windowMs - (at - recent[0]);
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }

      recent.push(at);
      attempts.set(key, recent);
      if (attempts.size > 500) sweep(at);
      return { ok: true };
    },
  };
}
