import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/server/rate-limit";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => void (now += ms) };
}

describe("createRateLimiter", () => {
  it("allows attempts up to the limit", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock().now });
    expect(limiter.check("a")).toEqual({ ok: true });
    expect(limiter.check("a")).toEqual({ ok: true });
    expect(limiter.check("a")).toEqual({ ok: true });
  });

  it("refuses the attempt after the limit and says how long to wait", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: time.now });
    limiter.check("a");
    time.advance(10_000);
    limiter.check("a");
    time.advance(5_000);

    // The first attempt was 15s ago, so it frees up in 45s.
    expect(limiter.check("a")).toEqual({ ok: false, retryAfterSeconds: 45 });
  });

  it("allows attempts again once the window has passed", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: time.now });
    limiter.check("a");
    expect(limiter.check("a").ok).toBe(false);

    time.advance(60_000);
    expect(limiter.check("a").ok).toBe(true);
  });

  it("slides: an old attempt ageing out frees exactly one slot", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: time.now });
    limiter.check("a"); // t=0
    time.advance(30_000);
    limiter.check("a"); // t=30s
    time.advance(31_000); // t=61s: the first has aged out, the second has not

    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
  });

  it("counts each person separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock().now });
    expect(limiter.check("alice").ok).toBe(true);
    expect(limiter.check("alice").ok).toBe(false);
    expect(limiter.check("bob").ok).toBe(true);
  });

  it("does not count a refused attempt against the person", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: time.now });
    limiter.check("a");
    // Hammering while limited must not push the release time further out.
    for (let i = 0; i < 20; i++) limiter.check("a");

    time.advance(60_000);
    expect(limiter.check("a").ok).toBe(true);
  });

  it("never reports a wait shorter than a second", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: time.now });
    limiter.check("a");
    time.advance(59_999);
    const result = limiter.check("a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("forgets people it has not heard from, so memory does not grow without bound", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: time.now });
    for (let i = 0; i < 600; i++) limiter.check(`user-${i}`);
    time.advance(5_000);

    // Crossing the sweep threshold again must not break anyone's limits.
    for (let i = 0; i < 600; i++) expect(limiter.check(`new-${i}`).ok).toBe(true);
    expect(limiter.check("new-0").ok).toBe(false);
  });
});
