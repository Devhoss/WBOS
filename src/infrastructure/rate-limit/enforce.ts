import {
  rateLimitResponse,
  type RateLimiter,
  type RateLimitRule,
} from "@/infrastructure/rate-limit/rate-limit";
import {
  ACCOUNT_RULES,
  accountLimiter,
  type AccountBucket,
} from "@/infrastructure/rate-limit/rules";

interface AccountRateLimitDeps {
  limiter?: RateLimiter;
  rule?: RateLimitRule;
}

/**
 * Per-account guard for authenticated mobile API handlers. Returns a 429
 * response when the user has exceeded the bucket's limit, or null to let the
 * request through. Call right after the authenticated context is resolved:
 *
 *   const limited = accountRateLimitOrNull(context.userId, "task-pick-actions");
 *   if (limited) return limited;
 *
 * No userId (unauthenticated request) is never limited here — those requests
 * are rejected by the caller's own auth check.
 */
export function accountRateLimitOrNull(
  userId: string | null | undefined,
  bucket: AccountBucket,
  deps: AccountRateLimitDeps = {},
): Response | null {
  if (!userId) return null;
  const limiter = deps.limiter ?? accountLimiter;
  const rule = deps.rule ?? ACCOUNT_RULES[bucket];
  const result = limiter.consume(`user:${userId}:${bucket}`, rule);
  if (!result.allowed) {
    return rateLimitResponse(result, "Too many requests. Please slow down and try again.");
  }
  return null;
}
