import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

vi.mock("@/lib/download/signed-token", () => ({
  verifyDownloadToken: () => false,
}));

function request(path: string, withSession = false): NextRequest {
  const req = new NextRequest(`https://wbos.example.com${path}`);
  if (withSession) {
    req.cookies.set("__Secure-better-auth.session_token", "session-value");
  }
  return req;
}

/** null = passed through; otherwise the Location it redirects to. */
function redirectTarget(path: string, withSession = false): string | null {
  const res = proxy(request(path, withSession));
  const location = res.headers.get("location");
  return res.status >= 300 && res.status < 400 && location ? location : null;
}

describe("proxy public routes", () => {
  it.each([
    ["/forgot-password"],
    ["/forgot-password/"],
    ["/reset-password"],
    ["/reset-password/"],
  ])("%s is reachable without a session", (path) => {
    // Password recovery exists precisely because the user CANNOT sign in.
    // Bouncing these to /sign-in makes the flow impossible to complete — this
    // shipped broken once and was caught only by end-to-end verification.
    expect(redirectTarget(path)).toBeNull();
  });

  it("reset-password keeps its token when reached without a session", () => {
    expect(redirectTarget("/reset-password?token=abc123")).toBeNull();
  });

  it.each([["/sign-in"], ["/sign-up"]])("%s stays public", (path) => {
    expect(redirectTarget(path)).toBeNull();
  });

  it("still protects application routes from anonymous access", () => {
    const target = redirectTarget("/settings/backups");
    expect(target).not.toBeNull();
    expect(target).toContain("/sign-in");
    expect(target).toContain("redirect=%2Fsettings%2Fbackups");
  });

  it("lets an authenticated user through to application routes", () => {
    expect(redirectTarget("/settings/backups", true)).toBeNull();
  });

  it("leaves API routes to their own authentication", () => {
    expect(redirectTarget("/api/v1/auth/me")).toBeNull();
    expect(redirectTarget("/api/auth/request-password-reset")).toBeNull();
  });
});
