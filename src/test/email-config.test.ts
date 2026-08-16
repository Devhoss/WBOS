import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isEmailEnabled, resolveSmtpConfig } from "@/infrastructure/email/config";
import { passwordResetEmail } from "@/infrastructure/email/password-reset-email";

const SMTP_VARS = [
  "WBOS_SMTP_HOST",
  "WBOS_SMTP_PORT",
  "WBOS_SMTP_SECURE",
  "WBOS_SMTP_USER",
  "WBOS_SMTP_PASSWORD",
  "WBOS_SMTP_FROM",
  "WBOS_SMTP_REJECT_UNAUTHORIZED",
];

describe("resolveSmtpConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of SMTP_VARS) delete process.env[key];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is disabled, not broken, when SMTP is intentionally not configured", () => {
    const result = resolveSmtpConfig();
    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.reason).toBe("disabled");
      expect(result.missing).toEqual([]);
    }
    expect(isEmailEnabled()).toBe(false);
  });

  it("enables with the minimum viable configuration", () => {
    process.env.WBOS_SMTP_HOST = "smtp.example.com";
    process.env.WBOS_SMTP_FROM = "WBOS <no-reply@example.com>";

    const result = resolveSmtpConfig();
    expect(result.enabled).toBe(true);
    if (result.enabled) {
      expect(result.config.host).toBe("smtp.example.com");
      expect(result.config.port).toBe(587); // default
      expect(result.config.secure).toBe(false); // STARTTLS on 587
      expect(result.config.auth).toBeNull(); // unauthenticated relay is valid
      expect(result.config.rejectUnauthorized).toBe(true);
    }
  });

  it("defaults to implicit TLS on port 465", () => {
    process.env.WBOS_SMTP_HOST = "smtp.example.com";
    process.env.WBOS_SMTP_FROM = "no-reply@example.com";
    process.env.WBOS_SMTP_PORT = "465";

    const result = resolveSmtpConfig();
    expect(result.enabled && result.config.secure).toBe(true);
  });

  it("reports incomplete configuration rather than half-working", () => {
    // Host set = intent to enable, but no From address.
    process.env.WBOS_SMTP_HOST = "smtp.example.com";

    const result = resolveSmtpConfig();
    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.reason).toBe("incomplete");
      expect(result.missing).toContain("WBOS_SMTP_FROM");
    }
  });

  it("rejects a username without a password", () => {
    process.env.WBOS_SMTP_HOST = "smtp.example.com";
    process.env.WBOS_SMTP_FROM = "no-reply@example.com";
    process.env.WBOS_SMTP_USER = "apikey";

    const result = resolveSmtpConfig();
    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.missing.join(" ")).toContain("WBOS_SMTP_PASSWORD");
    }
  });

  it("rejects a password without a username", () => {
    process.env.WBOS_SMTP_HOST = "smtp.example.com";
    process.env.WBOS_SMTP_FROM = "no-reply@example.com";
    process.env.WBOS_SMTP_PASSWORD = "secret";

    const result = resolveSmtpConfig();
    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.missing.join(" ")).toContain("WBOS_SMTP_USER");
    }
  });

  it("rejects an invalid port instead of silently falling back", () => {
    process.env.WBOS_SMTP_HOST = "smtp.example.com";
    process.env.WBOS_SMTP_FROM = "no-reply@example.com";
    process.env.WBOS_SMTP_PORT = "not-a-port";

    const result = resolveSmtpConfig();
    expect(result.enabled).toBe(false);
    if (!result.enabled) {
      expect(result.missing.join(" ")).toContain("WBOS_SMTP_PORT");
    }
  });

  it("allows disabling certificate verification for a local test relay", () => {
    process.env.WBOS_SMTP_HOST = "mailpit";
    process.env.WBOS_SMTP_FROM = "no-reply@example.com";
    process.env.WBOS_SMTP_REJECT_UNAUTHORIZED = "0";

    const result = resolveSmtpConfig();
    expect(result.enabled && result.config.rejectUnauthorized).toBe(false);
  });
});

describe("passwordResetEmail", () => {
  it("states the same lifetime the token actually has", () => {
    const mail = passwordResetEmail({
      to: "owner@example.com",
      name: "Owner",
      url: "https://wbos.example.com/api/auth/reset-password/abc",
      expiresInMinutes: 60,
    });

    expect(mail.to).toBe("owner@example.com");
    expect(mail.subject).toMatch(/reset/i);
    expect(mail.text).toContain("60 minutes");
    expect(mail.html).toContain("60 minutes");
  });

  it("uses the singular for a one-minute lifetime", () => {
    const mail = passwordResetEmail({
      to: "a@example.com",
      name: null,
      url: "https://example.com/x",
      expiresInMinutes: 1,
    });
    expect(mail.text).toContain("1 minute and");
  });

  it("includes the reset URL in both the text and HTML parts", () => {
    const url = "https://wbos.example.com/api/auth/reset-password/tok-123?callbackURL=%2Freset-password";
    const mail = passwordResetEmail({ to: "a@example.com", url, expiresInMinutes: 60 });

    expect(mail.text).toContain(url);
    expect(mail.html).toContain(url);
  });

  it("escapes user-controlled name content in the HTML part", () => {
    const mail = passwordResetEmail({
      to: "a@example.com",
      name: '<script>alert("x")</script>',
      url: "https://example.com/x",
      expiresInMinutes: 60,
    });

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("does not tell the recipient whether the account exists", () => {
    const mail = passwordResetEmail({
      to: "a@example.com",
      url: "https://example.com/x",
      expiresInMinutes: 60,
    });
    // The email only goes to real accounts; it must still be safe to forward.
    expect(mail.text).toContain("If you did not request this");
  });
});
