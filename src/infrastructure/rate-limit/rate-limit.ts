export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

/**
 * In-memory sliding-window rate limiter.
 *
 * Pure TS (Map + Date) so it runs anywhere Node does; no external store. Buckets
 * keep the timestamps of recent requests per key; a request is rejected when the
 * number of timestamps inside the sliding window already reached `limit`.
 *
 * Memory is bounded by `maxKeys` (default 100k): expired keys are swept and, if
 * still over the cap, the least-recently-used key is evicted.
 *
 * Suitable for the single-instance WBOS deployment. If the app is ever scaled to
 * multiple instances, this must be replaced with a shared store (e.g. the DB).
 */
export class RateLimiter {
  private readonly buckets = new Map<
    string,
    { timestamps: number[]; updatedAt: number }
  >();

  constructor(private readonly options: { maxKeys?: number } = {}) {}

  consume(key: string, rule: RateLimitRule): RateLimitResult {
    const now = Date.now();
    const cutoff = now - rule.windowMs;
    const maxKeys = this.options.maxKeys ?? 100_000;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= maxKeys) {
        this.evictExpired(cutoff);
        if (this.buckets.size >= maxKeys) {
          this.evictOldest();
        }
      }
      bucket = { timestamps: [], updatedAt: now };
      this.buckets.set(key, bucket);
    }

    const active = bucket.timestamps.filter((t) => t > cutoff);
    bucket.timestamps = active;
    bucket.updatedAt = now;

    if (active.length >= rule.limit) {
      const oldest = active[0];
      return {
        allowed: false,
        retryAfterMs: Math.max(1, oldest + rule.windowMs - now),
        remaining: 0,
      };
    }

    active.push(now);
    return { allowed: true, retryAfterMs: 0, remaining: rule.limit - active.length };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  get size(): number {
    return this.buckets.size;
  }

  private evictExpired(cutoff: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.updatedAt <= cutoff) {
        this.buckets.delete(key);
      }
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [key, bucket] of this.buckets) {
      if (bucket.updatedAt < oldestTs) {
        oldestTs = bucket.updatedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.buckets.delete(oldestKey);
    }
  }
}

/**
 * HTTP 429 response with a clear Retry-After.
 * `Retry-After` carries whole seconds per RFC 9110; `X-Retry-After` carries
 * milliseconds for clients that want precision.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  message: string,
): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return new Response(
    JSON.stringify({
      error: message,
      code: "RATE_LIMITED",
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        "X-Retry-After": String(result.retryAfterMs),
      },
    },
  );
}
