import { afterEach, describe, expect, it, vi } from "vitest";

import { withAuthRateLimit } from "@/infrastructure/rate-limit/auth-guard";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { getClientIp } from "@/infrastructure/rate-limit/ip";
import {
  RateLimiter,
  rateLimitResponse,
} from "@/infrastructure/rate-limit/rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

function request(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers: init.headers,
    body: init.body,
  });
}

describe("RateLimiter (core)", () => {
  it("allows requests up to the limit, then throttles", () => {
    const limiter = new RateLimiter();
    const rule = { limit: 3, windowMs: 60_000 };

    expect(limiter.consume("k", rule).allowed).toBe(true);
    expect(limiter.consume("k", rule).allowed).toBe(true);
    expect(limiter.consume("k", rule).allowed).toBe(true);
    expect(limiter.consume("k", rule).allowed).toBe(false);
    expect(limiter.consume("k", rule).allowed).toBe(false);
  });

  it("reports a positive Retry-After while throttled and it shrinks as the window slides", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const limiter = new RateLimiter();
    const rule = { limit: 1, windowMs: 10_000 };

    expect(limiter.consume("k", rule).allowed).toBe(true);
    expect(limiter.consume("k", rule).retryAfterMs).toBe(10_000);

    vi.advanceTimersByTime(4_000);
    const second = limiter.consume("k", rule);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBe(6_000);

    vi.advanceTimersByTime(6_000);
    expect(limiter.consume("k", rule).allowed).toBe(true);
  });

  it("resets its window after the window elapses (window/reset behavior)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const limiter = new RateLimiter();
    const rule = { limit: 2, windowMs: 60_000 };

    limiter.consume("k", rule);
    limiter.consume("k", rule);
    expect(limiter.consume("k", rule).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(limiter.consume("k", rule).allowed).toBe(true);
  });

  it("keeps keys independent", () => {
    const limiter = new RateLimiter();
    const rule = { limit: 1, windowMs: 60_000 };

    expect(limiter.consume("a", rule).allowed).toBe(true);
    expect(limiter.consume("a", rule).allowed).toBe(false);
    expect(limiter.consume("b", rule).allowed).toBe(true);
  });

  it("resets a key on demand (reset behavior)", () => {
    const limiter = new RateLimiter();
    const rule = { limit: 2, windowMs: 60_000 };

    limiter.consume("k", rule);
    limiter.consume("k", rule);
    expect(limiter.consume("k", rule).allowed).toBe(false);

    limiter.reset("k");
    expect(limiter.consume("k", rule).allowed).toBe(true);
  });

  it("allows exactly `limit` of many concurrent requests", async () => {
    const limiter = new RateLimiter();
    const rule = { limit: 5, windowMs: 60_000 };

    const results = await Promise.all(
      Array.from({ length: 50 }, () => Promise.resolve(limiter.consume("k", rule))),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.filter((r) => !r.allowed)).toHaveLength(45);
  });

  it("bounds memory by evicting old keys", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const limiter = new RateLimiter({ maxKeys: 2 });
    const rule = { limit: 100, windowMs: 60_000 };

    limiter.consume("a", rule); // t=0s
    vi.advanceTimersByTime(30_000);
    limiter.consume("b", rule); // t=30s, "a" still alive
    expect(limiter.size).toBe(2);

    vi.advanceTimersByTime(40_000); // now t=70s
    limiter.consume("c", rule); // "a" expired (t=0 < cutoff t=10s), "b" alive -> 2 keys
    expect(limiter.size).toBe(2);

    limiter.consume("d", rule); // over cap, nothing expired -> evict oldest ("b")
    expect(limiter.size).toBe(2);
    expect(limiter.consume("b", rule).allowed).toBe(true); // "b" was evicted, fresh bucket
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with Retry-After headers and a clear body", async () => {
    const res = rateLimitResponse({ allowed: false, retryAfterMs: 1_500, remaining: 0 }, "Slow down.");

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("2");
    expect(res.headers.get("X-Retry-After")).toBe("1500");
    expect(res.headers.get("Content-Type")).toContain("application/json");
    await expect(res.json()).resolves.toEqual({
      error: "Slow down.",
      code: "RATE_LIMITED",
      retryAfterSeconds: 2,
    });
  });
});

describe("getClientIp", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("takes the rightmost X-Forwarded-For entry behind one trusted proxy", () => {
    const req = request("/x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.2" } });
    expect(getClientIp(req.headers)).toBe("10.0.0.2");
  });

  it("ignores a forged leftmost entry so per-IP limits cannot be bypassed", () => {
    // The attacker varies the forged prefix on every request; the proxy-appended
    // rightmost entry stays constant, so all of these share one bucket.
    const forged = ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((fake) =>
      getClientIp(
        request("/x", { headers: { "x-forwarded-for": `${fake}, 198.51.100.5` } }).headers,
      ),
    );
    expect(forged).toEqual(["198.51.100.5", "198.51.100.5", "198.51.100.5"]);
  });

  it("counts hops from the right when several proxies are trusted", () => {
    process.env.WBOS_TRUSTED_PROXY_HOPS = "2";
    const req = request("/x", {
      headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.7, 10.0.0.2" },
    });
    expect(getClientIp(req.headers)).toBe("203.0.113.7");
  });

  it("fails closed when the chain is shorter than the configured hop count", () => {
    process.env.WBOS_TRUSTED_PROXY_HOPS = "2";
    const req = request("/x", { headers: { "x-forwarded-for": "203.0.113.7" } });
    expect(getClientIp(req.headers)).toBeNull();
  });

  it("ignores forwarding headers entirely when no proxy is trusted", () => {
    process.env.WBOS_TRUSTED_PROXY_HOPS = "0";
    const req = request("/x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.2" } });
    expect(getClientIp(req.headers)).toBeNull();
  });

  it("rejects the unknown placeholder rather than falling back to another hop", () => {
    const req = request("/x", { headers: { "x-forwarded-for": "10.0.0.2, unknown" } });
    expect(getClientIp(req.headers)).toBeNull();
  });

  it("rejects a non-address value in the trusted position", () => {
    const req = request("/x", { headers: { "x-forwarded-for": "10.0.0.2, not-an-ip" } });
    expect(getClientIp(req.headers)).toBeNull();
  });

  it("strips a port from the trusted entry", () => {
    const req = request("/x", { headers: { "x-forwarded-for": "203.0.113.7:44321" } });
    expect(getClientIp(req.headers)).toBe("203.0.113.7");
  });

  it("unwraps a bracketed IPv6 address with a port", () => {
    const req = request("/x", { headers: { "x-forwarded-for": "[2001:db8::1]:44321" } });
    expect(getClientIp(req.headers)).toBe("2001:db8::1");
  });

  it("does not trust X-Real-IP by default", () => {
    const req = request("/x", { headers: { "x-real-ip": "203.0.113.9" } });
    expect(getClientIp(req.headers)).toBeNull();
  });

  it("uses X-Real-IP when the deployment opts in", () => {
    process.env.WBOS_TRUST_X_REAL_IP = "1";
    const req = request("/x", { headers: { "x-real-ip": "203.0.113.9" } });
    expect(getClientIp(req.headers)).toBe("203.0.113.9");
  });

  it("returns null when no IP headers are present", () => {
    expect(getClientIp(request("/x").headers)).toBeNull();
  });
});

describe("accountRateLimitOrNull", () => {
  const deps = (limiter: RateLimiter) => ({ limiter });

  it("returns null when there is no userId (never limits unauthenticated requests)", () => {
    const limiter = new RateLimiter();
    expect(accountRateLimitOrNull(null, "auth-me", deps(limiter))).toBeNull();
    expect(accountRateLimitOrNull(undefined, "auth-me", deps(limiter))).toBeNull();
    expect(limiter.size).toBe(0);
  });

  it("returns null while under the limit and a 429 once exceeded", async () => {
    const limiter = new RateLimiter();
    const opts = { limiter, rule: { limit: 2, windowMs: 60_000 } };

    expect(accountRateLimitOrNull("user-1", "auth-me", opts)).toBeNull();
    expect(accountRateLimitOrNull("user-1", "auth-me", opts)).toBeNull();

    const blocked = accountRateLimitOrNull("user-1", "auth-me", opts);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();
    await expect(blocked!.json()).resolves.toMatchObject({ code: "RATE_LIMITED" });

    // Buckets are per-user: a different user is unaffected by the same rule.
    expect(accountRateLimitOrNull("user-2", "auth-me", opts)).toBeNull();
  });
});

describe("withAuthRateLimit", () => {
  const makeInner = (status = 200) =>
    vi.fn(async () => new Response("ok", { status }));

  function guard(
    inner: (req: Request) => Promise<Response>,
    deps: { ip?: RateLimiter; account?: RateLimiter } = {},
  ) {
    return withAuthRateLimit(inner, {
      ipLimiter: deps.ip,
      accountLimiter: deps.account,
    });
  }

  it("passes non-credential auth paths through untouched", async () => {
    const inner = makeInner();
    const handler = guard(inner, { ip: new RateLimiter(), account: new RateLimiter() });

    const res = await handler(request("/api/auth/get-session", { headers: { "x-forwarded-for": "1.2.3.4" } }));
    expect(res.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("throttles sign-in per IP: allows the limit, then returns 429 with Retry-After", async () => {
    const inner = makeInner(401);
    const handler = guard(inner, { ip: new RateLimiter(), account: new RateLimiter() });
    const headers = { "x-forwarded-for": "203.0.113.1" };
    const signIn = (email: string) =>
      request("/api/auth/sign-in/email", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password: "x" }),
      });

    // Distinct emails keep the per-account rule from firing; this isolates the
    // per-IP rule (default 10 per minute).
    for (let i = 0; i < 10; i++) {
      const res = await handler(signIn(`a${i}@b.com`));
      expect(res.status).toBe(401);
    }
    const blocked = await handler(signIn("a10@b.com"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    await expect(blocked.json()).resolves.toMatchObject({ code: "RATE_LIMITED" });
    expect(inner).toHaveBeenCalledTimes(10);
  });

  it("does not share per-IP buckets across different IPs", async () => {
    const inner = makeInner(401);
    const handler = guard(inner, { ip: new RateLimiter(), account: new RateLimiter() });
    const signIn = (ip: string, email: string) =>
      request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email, password: "x" }),
      });

    for (let i = 0; i < 11; i++) {
      await handler(signIn("203.0.113.1", `a${i}@b.com`));
    }
    expect((await handler(signIn("203.0.113.1", "a11@b.com"))).status).toBe(429);

    const other = await handler(signIn("203.0.113.2", "b0@b.com"));
    expect(other.status).toBe(401); // not blocked
  });

  it("backoffs the account across IPs: 5 failed attempts then 429 for that email", async () => {
    const inner = makeInner(401);
    const handler = guard(inner, { ip: new RateLimiter(), account: new RateLimiter() });
    const signIn = (email: string) =>
      request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.99" },
        body: JSON.stringify({ email, password: "wrong" }),
      });

    for (let i = 0; i < 5; i++) {
      expect((await handler(signIn("victim@example.com"))).status).toBe(401);
    }
    const blocked = await handler(signIn("victim@example.com"));
    expect(blocked.status).toBe(429);

    // A different email is unaffected.
    expect((await handler(signIn("other@example.com"))).status).toBe(401);
  });

  it("locks the account for the window after repeated failures, even on a correct password", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    let status = 401;
    const inner = vi.fn(async () => new Response("ok", { status }));
    const handler = guard(inner, { ip: new RateLimiter(), account: new RateLimiter() });
    const signIn = () =>
      request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.50" },
        body: JSON.stringify({ email: "me@example.com", password: "x" }),
      });

    for (let i = 0; i < 5; i++) {
      await handler(signIn()); // 5 failed -> backoff now engaged
    }
    expect((await handler(signIn())).status).toBe(429);

    status = 200; // correct password now
    expect((await handler(signIn())).status).toBe(429); // still locked out

    vi.advanceTimersByTime(900_001); // 15-min window passes
    expect((await handler(signIn())).status).toBe(200); // recovered
  });

  it("resets the account backoff on a successful sign-in before the limit is hit", async () => {
    let status = 401;
    const inner = vi.fn(async () => new Response("ok", { status }));
    const handler = guard(inner, { ip: new RateLimiter(), account: new RateLimiter() });
    const signIn = () =>
      request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.60" },
        body: JSON.stringify({ email: "me@example.com", password: "x" }),
      });

    for (let i = 0; i < 3; i++) {
      expect((await handler(signIn())).status).toBe(401); // 3 failures
    }

    status = 200;
    expect((await handler(signIn())).status).toBe(200); // allowed + resets the backoff

    status = 401;
    for (let i = 0; i < 5; i++) {
      expect((await handler(signIn())).status).toBe(401); // fresh allowance again
    }
    expect((await handler(signIn())).status).toBe(429);
  });

  it("uses the default limiters when none are injected", async () => {
    const inner = makeInner(200);
    const handler = withAuthRateLimit(inner);
    const res = await handler(
      request("/api/auth/get-session", { headers: { "x-forwarded-for": "198.51.100.9" } }),
    );
    expect(res.status).toBe(200);
  });
});
