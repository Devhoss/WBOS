import {
  rateLimitResponse,
  type RateLimiter,
  type RateLimitRule,
} from "@/infrastructure/rate-limit/rate-limit";
import { getClientIp } from "@/infrastructure/rate-limit/ip";
import {
  AUTH_ACCOUNT_RULES,
  AUTH_IP_RULES,
  authAccountLimiter,
  ipLimiter,
} from "@/infrastructure/rate-limit/rules";

interface AuthRateLimitDeps {
  ipLimiter?: RateLimiter;
  accountLimiter?: RateLimiter;
}

function ruleFor(rules: Record<string, RateLimitRule>, path: string): RateLimitRule | undefined {
  return rules[path];
}

/**
 * Wraps the Better Auth handler with rate limiting on the credential endpoints:
 *
 *  - per-IP limits for sign-in/sign-up/password-reset/verify-password so a
 *    single host cannot brute-force or flood the auth API;
 *  - per-email backoff for sign-in and verify-password so credentials cannot be
 *    brute-forced from many IPs against one account.
 *
 * A successful credential check resets the per-email backoff, so a user who
 * mistyped a password a few times recovers immediately on a correct attempt.
 * All other auth paths (get-session, sign-out, ...) pass through untouched.
 *
 * Better Auth's own built-in limiter is disabled (auth.ts) because its IP
 * detection cannot be trusted behind the multi-hop reverse proxy used in the
 * WBOS deployment and its default 3-per-10s sign-in window is stricter than a
 * normal human needs.
 */
export function withAuthRateLimit(
  inner: (req: Request) => Promise<Response>,
  deps: AuthRateLimitDeps = {},
): (req: Request) => Promise<Response> {
  const ipBucket = deps.ipLimiter ?? ipLimiter;
  const accountBucket = deps.accountLimiter ?? authAccountLimiter;

  return async (req: Request): Promise<Response> => {
    const path = new URL(req.url).pathname;

    const ipRule = ruleFor(AUTH_IP_RULES, path);
    if (ipRule) {
      const ip = getClientIp(req.headers);
      if (ip) {
        const result = ipBucket.consume(`ip:${ip}`, ipRule);
        if (!result.allowed) {
          return rateLimitResponse(
            result,
            "Too many attempts from this IP. Please try again later.",
          );
        }
      }
    }

    const accountRule = ruleFor(AUTH_ACCOUNT_RULES, path);
    let emailKey: string | null = null;
    if (accountRule) {
      const body = (await req.clone().json().catch(() => null)) as {
        email?: unknown;
      } | null;
      const email =
        typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
      if (email) {
        emailKey = email;
        const result = accountBucket.consume(`email:${email}`, accountRule);
        if (!result.allowed) {
          return rateLimitResponse(
            result,
            "Too many failed attempts for this account. Please try again later.",
          );
        }
      }
    }

    const response = await inner(req);

    if (emailKey && response.status >= 200 && response.status < 400) {
      accountBucket.reset(`email:${emailKey}`);
    }

    return response;
  };
}
