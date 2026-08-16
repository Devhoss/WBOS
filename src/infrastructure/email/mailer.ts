import nodemailer, { type Transporter } from "nodemailer";

import { resolveSmtpConfig, type SmtpConfig } from "@/infrastructure/email/config";

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Raised when a send is attempted while SMTP is not usable. Callers decide
 * whether that is fatal; the password-reset path treats it as non-fatal so the
 * endpoint keeps its enumeration-safe response.
 */
export class EmailNotConfiguredError extends Error {
  constructor(detail: string) {
    super(`Email is not configured: ${detail}`);
    this.name = "EmailNotConfiguredError";
  }
}

let cached: { key: string; transporter: Transporter } | null = null;

/**
 * Transports are reused so the SMTP connection pool survives across requests.
 * The cache key includes the settings, so changing configuration in a test (or
 * a restart-free env reload) does not hand back a stale transport.
 */
function getTransporter(config: SmtpConfig): Transporter {
  const key = JSON.stringify({
    h: config.host,
    p: config.port,
    s: config.secure,
    u: config.auth?.user ?? null,
    r: config.rejectUnauthorized,
  });

  if (cached?.key === key) return cached.transporter;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth ?? undefined,
    tls: { rejectUnauthorized: config.rejectUnauthorized },
  });

  cached = { key, transporter };
  return transporter;
}

/** Test seam — drops the memoized transport. */
export function resetMailerForTests(): void {
  cached = null;
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const resolution = resolveSmtpConfig();

  if (!resolution.enabled) {
    throw new EmailNotConfiguredError(
      resolution.reason === "disabled"
        ? "WBOS_SMTP_HOST is not set"
        : `missing or invalid: ${resolution.missing.join(", ")}`,
    );
  }

  const { config } = resolution;

  await getTransporter(config).sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  });
}
