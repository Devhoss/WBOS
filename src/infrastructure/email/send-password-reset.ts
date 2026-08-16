import { isEmailEnabled } from "@/infrastructure/email/config";
import { sendEmail } from "@/infrastructure/email/mailer";
import { passwordResetEmail } from "@/infrastructure/email/password-reset-email";

/**
 * Lifetime of a password-reset link, in seconds.
 *
 * Better Auth defaults to 1 hour; it is set explicitly so the value is visible
 * and so the email never states a different lifetime than the token enforces.
 */
export function resetTokenTtlSeconds(): number {
  const raw = Number(process.env.WBOS_RESET_TOKEN_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3600;
}

/**
 * Handler passed to Better Auth's `emailAndPassword.sendResetPassword`.
 *
 * Better Auth invokes this only after creating a single-use token, and runs it
 * through `runInBackgroundOrAwait`, which catches and logs throws. The endpoint
 * therefore keeps returning its deliberately vague "if this email exists..."
 * response and never reveals whether the address is registered or whether
 * delivery succeeded.
 *
 * When SMTP is not configured we log loudly and return without sending. The
 * request looks identical from outside; the operator sees why in the logs, and
 * the forgot-password page separately tells users recovery is unavailable
 * rather than leaving them waiting for mail that will never arrive.
 */
export async function sendPasswordResetEmail({
  user,
  url,
}: {
  user: { email: string; name?: string | null };
  url: string;
}): Promise<void> {
  if (!isEmailEnabled()) {
    console.warn(
      "[auth] Password reset requested but SMTP is not configured — no email sent. " +
        "Set WBOS_SMTP_HOST and related variables to enable password recovery.",
    );
    return;
  }

  const ttl = resetTokenTtlSeconds();

  await sendEmail(
    passwordResetEmail({
      to: user.email,
      name: user.name,
      url,
      expiresInMinutes: Math.max(1, Math.round(ttl / 60)),
    }),
  );
}
