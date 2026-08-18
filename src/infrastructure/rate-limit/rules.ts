import { RateLimiter, type RateLimitRule } from "@/infrastructure/rate-limit/rate-limit";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Chosen limits (see docs/PRODUCTION_READINESS.md → Rate limiting for the full
 * rationale). Adjust for production via the documented env vars; anything not
 * env-driven can be tuned here.
 */
export const AUTH_IP_RULES = {
  "/api/auth/sign-in/email": {
    limit: envInt("WBOS_RATE_LIMIT_SIGNIN_IP", 10),
    windowMs: 60_000,
  },
  "/api/auth/sign-up/email": { limit: 5, windowMs: 60_000 },
  "/api/auth/request-password-reset": { limit: 5, windowMs: 60_000 },
  "/api/auth/send-verification-email": { limit: 5, windowMs: 60_000 },
  "/api/auth/reset-password": { limit: 10, windowMs: 60_000 },
  "/api/auth/verify-password": { limit: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export const AUTH_ACCOUNT_RULES = {
  "/api/auth/sign-in/email": {
    limit: envInt("WBOS_RATE_LIMIT_SIGNIN_ACCOUNT", 5),
    windowMs: 900_000,
  },
  "/api/auth/verify-password": { limit: 5, windowMs: 900_000 },
} as const satisfies Record<string, RateLimitRule>;

export const ACCOUNT_RULES = {
  "device-tokens": { limit: 30, windowMs: 60_000 },
  "signed-invoice-upload": { limit: 20, windowMs: 60_000 },
  "invoice-download-token": { limit: 30, windowMs: 60_000 },
  "shipment-deliver": { limit: 10, windowMs: 60_000 },
  "shipment-status": { limit: 60, windowMs: 60_000 },
  "shipment-warehouse-notes": { limit: 60, windowMs: 60_000 },
  "task-pick-actions": { limit: 600, windowMs: 60_000 },
  "task-start": { limit: 120, windowMs: 60_000 },
  "task-complete": { limit: 120, windowMs: 60_000 },
  "task-cancel": { limit: 120, windowMs: 60_000 },
  "task-line-update": { limit: 120, windowMs: 60_000 },
  "notification-read": { limit: 120, windowMs: 60_000 },
  "notification-read-all": { limit: 60, windowMs: 60_000 },
  "notification-clear-read": { limit: 60, windowMs: 60_000 },
  "notification-delete": { limit: 60, windowMs: 60_000 },
  "auth-me": { limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type AccountBucket = keyof typeof ACCOUNT_RULES;

/** Per-IP limits for unauthenticated auth endpoints. */
export const ipLimiter = new RateLimiter({ maxKeys: 20_000 });
/** Per-account limits for authenticated mobile API endpoints. */
export const accountLimiter = new RateLimiter({ maxKeys: 20_000 });
/** Per-email backoff for credential checks (sign-in / verify-password). */
export const authAccountLimiter = new RateLimiter({ maxKeys: 20_000 });
