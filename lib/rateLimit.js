// In-memory, single-instance rate limiter. Fine for a demo/portfolio
// deployment; a production version behind multiple server instances
// would need a shared store (Redis/Upstash) instead of this Map, since
// each instance would otherwise keep its own count. Documented here
// rather than hidden, because knowing the limitation is the point.

const buckets = new Map();

export function rateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = existing && now <= existing.resetAt ? existing : { count: 0, resetAt: now + windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map doesn't grow unbounded over a long
  // running process.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt
  };
}

export function getClientKey(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
