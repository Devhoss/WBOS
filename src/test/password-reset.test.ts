import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";

import { sendPasswordResetEmail } from "@/infrastructure/email/send-password-reset";

/**
 * Password recovery flow, exercised against a real Better Auth instance
 * (in-memory SQLite) using the SAME sendResetPassword handler that
 * src/infrastructure/auth/auth.ts installs — so the wiring under test is the
 * production wiring, not a copy of it.
 *
 * Only the SMTP transport itself is mocked; everything above it is real:
 * token creation, expiry, single-use consumption, session revocation.
 */
const sent: Array<{ to: string; subject: string; text: string; html?: string }> = [];

vi.mock("@/infrastructure/email/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/email/mailer")>();
  return {
    ...actual,
    sendEmail: vi.fn(async (message) => {
      sent.push(message);
    }),
  };
});

const BASE = "http://localhost:3000";
const SMTP_VARS = ["WBOS_SMTP_HOST", "WBOS_SMTP_FROM", "WBOS_RESET_TOKEN_TTL_SECONDS"];

function enableSmtp() {
  process.env.WBOS_SMTP_HOST = "smtp.test.local";
  process.env.WBOS_SMTP_FROM = "WBOS <no-reply@test.local>";
}

/** Pull the token out of the emailed callback URL, as a real user's click would. */
function tokenFromEmail(text: string): string {
  const match = text.match(/reset-password\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`No reset token in email:\n${text}`);
  return match[1];
}

async function makeInstance(ttlSeconds?: number) {
  return getTestInstance(
    {
      emailAndPassword: {
        enabled: true,
        ...(ttlSeconds ? { resetPasswordTokenExpiresIn: ttlSeconds } : {}),
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: sendPasswordResetEmail,
      },
    },
    {},
  );
}

async function post(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  path: string,
  body: unknown,
) {
  return fetchImpl(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Each case may spin up a fresh Better Auth instance (in-memory SQLite plus
// schema setup) and one case waits out a real 1-second token expiry. That
// comfortably exceeds vitest's 5s default on a loaded machine or CI runner, so
// the budget is raised here rather than left to flake intermittently.
describe("password reset flow", { timeout: 30_000 }, () => {
  const originalEnv = { ...process.env };
  let instance: Awaited<ReturnType<typeof makeInstance>>;

  beforeAll(async () => {
    enableSmtp();
    instance = await makeInstance();
  });

  beforeEach(() => {
    sent.length = 0;
    enableSmtp();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    for (const key of SMTP_VARS) delete process.env[key];
  });

  it("request-reset: sends a reset link to a registered address", async () => {
    const res = await post(instance.customFetchImpl, "/request-password-reset", {
      email: instance.testUser.email,
      redirectTo: "/reset-password",
    });

    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(instance.testUser.email);
    expect(sent[0].subject).toMatch(/reset/i);
    // The link is the callback endpoint, which validates the token then
    // redirects to our page.
    expect(sent[0].text).toContain("/api/auth/reset-password/");
  });

  it("request-reset: an unknown address gets the same response and no email", async () => {
    const res = await post(instance.customFetchImpl, "/request-password-reset", {
      email: "definitely-not-registered@example.com",
      redirectTo: "/reset-password",
    });

    // Enumeration safety: identical status and message, but nothing is sent.
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("request-reset: succeeds without throwing when SMTP is disabled", async () => {
    delete process.env.WBOS_SMTP_HOST;
    delete process.env.WBOS_SMTP_FROM;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await post(instance.customFetchImpl, "/request-password-reset", {
      email: instance.testUser.email,
      redirectTo: "/reset-password",
    });

    // Graceful degradation: the endpoint still behaves normally, nothing is
    // sent, and the operator gets a clear reason in the logs.
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SMTP is not configured"));
    warn.mockRestore();
  });

  it("successful reset: sets the new password and signs the user in with it", async () => {
    const fresh = await makeInstance();
    const newPassword = "brand-new-password-123";

    await post(fresh.customFetchImpl, "/request-password-reset", {
      email: fresh.testUser.email,
      redirectTo: "/reset-password",
    });
    const token = tokenFromEmail(sent.at(-1)!.text);

    const reset = await post(fresh.customFetchImpl, "/reset-password", {
      newPassword,
      token,
    });
    expect(reset.status).toBe(200);

    // Login with the NEW password succeeds...
    const withNew = await post(fresh.customFetchImpl, "/sign-in/email", {
      email: fresh.testUser.email,
      password: newPassword,
    });
    expect(withNew.status).toBe(200);

    // ...and the OLD password no longer works.
    const withOld = await post(fresh.customFetchImpl, "/sign-in/email", {
      email: fresh.testUser.email,
      password: fresh.testUser.password,
    });
    expect(withOld.status).not.toBe(200);
  });

  it("successful reset: revokes sessions issued before the reset", async () => {
    const fresh = await makeInstance();

    const signIn = await post(fresh.customFetchImpl, "/sign-in/email", {
      email: fresh.testUser.email,
      password: fresh.testUser.password,
    });
    const oldToken = signIn.headers.get("set-auth-token");
    expect(oldToken).toBeTruthy();

    const before = await fresh.auth.api.getSession({
      headers: new Headers({ Authorization: `Bearer ${oldToken}` }),
    });
    expect(before).not.toBeNull();

    await post(fresh.customFetchImpl, "/request-password-reset", {
      email: fresh.testUser.email,
      redirectTo: "/reset-password",
    });
    await post(fresh.customFetchImpl, "/reset-password", {
      newPassword: "another-new-password-123",
      token: tokenFromEmail(sent.at(-1)!.text),
    });

    // A session captured before the reset must not survive it.
    const after = await fresh.auth.api.getSession({
      headers: new Headers({ Authorization: `Bearer ${oldToken}` }),
    });
    expect(after).toBeNull();
  });

  it("invalid token: a forged token is rejected", async () => {
    const res = await post(instance.customFetchImpl, "/reset-password", {
      newPassword: "should-not-be-applied-123",
      token: "totally-made-up-token",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("INVALID_TOKEN");
  });

  it("invalid token: a token cannot be reused", async () => {
    const fresh = await makeInstance();

    await post(fresh.customFetchImpl, "/request-password-reset", {
      email: fresh.testUser.email,
      redirectTo: "/reset-password",
    });
    const token = tokenFromEmail(sent.at(-1)!.text);

    const first = await post(fresh.customFetchImpl, "/reset-password", {
      newPassword: "first-use-password-123",
      token,
    });
    expect(first.status).toBe(200);

    const second = await post(fresh.customFetchImpl, "/reset-password", {
      newPassword: "second-use-password-123",
      token,
    });
    expect(second.status).toBe(400);
  });

  it("expired token: a token past its lifetime is rejected", async () => {
    // One-second lifetime so real expiry can be observed rather than simulated.
    const shortLived = await makeInstance(1);

    await post(shortLived.customFetchImpl, "/request-password-reset", {
      email: shortLived.testUser.email,
      redirectTo: "/reset-password",
    });
    const token = tokenFromEmail(sent.at(-1)!.text);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const res = await post(shortLived.customFetchImpl, "/reset-password", {
      newPassword: "too-late-password-123",
      token,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("INVALID_TOKEN");

    // And the password really did not change.
    const stillOld = await post(shortLived.customFetchImpl, "/sign-in/email", {
      email: shortLived.testUser.email,
      password: shortLived.testUser.password,
    });
    expect(stillOld.status).toBe(200);
  });

  it("mobile Bearer auth still works after a password reset", async () => {
    // Guards the requirement that password recovery does not disturb the
    // mobile authentication model.
    const fresh = await makeInstance();
    const newPassword = "mobile-after-reset-123";

    await post(fresh.customFetchImpl, "/request-password-reset", {
      email: fresh.testUser.email,
      redirectTo: "/reset-password",
    });
    await post(fresh.customFetchImpl, "/reset-password", {
      newPassword,
      token: tokenFromEmail(sent.at(-1)!.text),
    });

    const signIn = await post(fresh.customFetchImpl, "/sign-in/email", {
      email: fresh.testUser.email,
      password: newPassword,
    });
    const bearer = signIn.headers.get("set-auth-token");
    expect(bearer).toBeTruthy();

    const session = await fresh.auth.api.getSession({
      headers: new Headers({ Authorization: `Bearer ${bearer}` }),
    });
    expect(session?.user.email).toBe(fresh.testUser.email);
  });
});
