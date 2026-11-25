/**
 * Small dependency-free, in-memory fixed-window rate limiter.
 *
 * This is intentionally per-process: it is enough to blunt brute-force and
 * scraping attempts on a single backend instance without adding Redis as a
 * hard dependency for auth. Expired buckets are pruned on every request.
 */
function rateLimit({
  windowMs = 60 * 1000,
  max = 60,
  message = 'Too many requests. Please try again later.',
  keyGenerator,
} = {}) {
  const buckets = new Map();

  function prune(now) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.startedAt >= windowMs) {
        buckets.delete(key);
      }
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    prune(now);

    const key = keyGenerator
      ? keyGenerator(req)
      : (req.ip || (req.socket && req.socket.remoteAddress) || 'unknown');
    let bucket = buckets.get(key);

    if (!bucket || now - bucket.startedAt >= windowMs) {
      bucket = { startedAt: now, count: 0 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

module.exports = { rateLimit };
