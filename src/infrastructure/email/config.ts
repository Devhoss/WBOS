/**
 * SMTP configuration, resolved from environment variables.
 *
 * Password recovery is OPTIONAL. WBOS runs perfectly well without SMTP — the
 * only consequence is that the forgot-password flow is unavailable and says so
 * plainly instead of pretending to send mail.
 *
 * `WBOS_SMTP_HOST` is the switch: setting it declares intent to enable
 * password recovery. Once set, the remaining required values must also be
 * present, and startup validation fails loudly if they are not — a
 * half-configured mailer is worse than no mailer, because the failure only
 * shows up when somebody is already locked out.
 */

export type SmtpConfig = {
  host: string;
  port: number;
  /** Implicit TLS (SMTPS). Defaults to true on port 465, STARTTLS otherwise. */
  secure: boolean;
  auth: { user: string; pass: string } | null;
  /** RFC 5322 From header, e.g. `WBOS <no-reply@example.com>`. */
  from: string;
  /** Verify the server certificate. Only disable for a local test relay. */
  rejectUnauthorized: boolean;
};

export type SmtpResolution =
  | { enabled: true; config: SmtpConfig }
  /** WBOS_SMTP_HOST is unset — password recovery is deliberately off. */
  | { enabled: false; reason: "disabled"; missing: [] }
  /** WBOS_SMTP_HOST is set but the configuration is incomplete or invalid. */
  | { enabled: false; reason: "incomplete"; missing: string[] };

function trimmed(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Truthy unless explicitly "0"/"false"/"no". */
function envFlag(name: string, fallback: boolean): boolean {
  const raw = trimmed(name).toLowerCase();
  if (raw === "") return fallback;
  return !["0", "false", "no", "off"].includes(raw);
}

export function resolveSmtpConfig(): SmtpResolution {
  const host = trimmed("WBOS_SMTP_HOST");
  if (host === "") {
    return { enabled: false, reason: "disabled", missing: [] };
  }

  const missing: string[] = [];

  const portRaw = trimmed("WBOS_SMTP_PORT") || "587";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    missing.push(`WBOS_SMTP_PORT (invalid: "${portRaw}")`);
  }

  const from = trimmed("WBOS_SMTP_FROM");
  if (from === "") {
    missing.push("WBOS_SMTP_FROM");
  }

  // Auth is optional: an internal relay may accept unauthenticated mail from
  // the app host. But a username without a password is always a mistake.
  const user = trimmed("WBOS_SMTP_USER");
  const pass = process.env.WBOS_SMTP_PASSWORD ?? "";
  if (user !== "" && pass === "") {
    missing.push("WBOS_SMTP_PASSWORD (set because WBOS_SMTP_USER is set)");
  }
  if (user === "" && pass !== "") {
    missing.push("WBOS_SMTP_USER (set because WBOS_SMTP_PASSWORD is set)");
  }

  if (missing.length > 0) {
    return { enabled: false, reason: "incomplete", missing };
  }

  return {
    enabled: true,
    config: {
      host,
      port,
      secure: envFlag("WBOS_SMTP_SECURE", port === 465),
      auth: user !== "" ? { user, pass } : null,
      from,
      rejectUnauthorized: envFlag("WBOS_SMTP_REJECT_UNAUTHORIZED", true),
    },
  };
}

/** True when password recovery emails can actually be delivered. */
export function isEmailEnabled(): boolean {
  return resolveSmtpConfig().enabled;
}
