import type { OutgoingEmail } from "@/infrastructure/email/mailer";

/**
 * Minutes the reset link stays valid. Mirrors `resetPasswordTokenExpiresIn` in
 * the Better Auth config so the email never promises a different lifetime than
 * the token actually has.
 */
export function passwordResetEmail(input: {
  to: string;
  name?: string | null;
  url: string;
  expiresInMinutes: number;
}): OutgoingEmail {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const validFor = `${input.expiresInMinutes} minute${input.expiresInMinutes === 1 ? "" : "s"}`;

  const text = [
    greeting,
    "",
    "We received a request to reset your WBOS password.",
    "",
    "Open this link to choose a new password:",
    input.url,
    "",
    `The link is valid for ${validFor} and can only be used once.`,
    "",
    "If you did not request this, you can ignore this email — your password stays unchanged.",
    "",
    "— WBOS",
  ].join("\n");

  // Deliberately plain: inline styles only, no images, no tracking, no external
  // requests. Mail clients strip most CSS and the operator is not running a
  // marketing stack.
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;">
            We received a request to reset your WBOS password.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${escapeAttribute(input.url)}"
               style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
              Choose a new password
            </a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#4b5563;">
            The link is valid for ${escapeHtml(validFor)} and can only be used once.
            If the button does not work, copy this address into your browser:
          </p>
          <p style="margin:0 0 16px;font-size:12px;line-height:18px;color:#4b5563;word-break:break-all;">
            ${escapeHtml(input.url)}
          </p>
          <p style="margin:0;font-size:13px;line-height:20px;color:#4b5563;">
            If you did not request this, you can ignore this email — your password stays unchanged.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to: input.to,
    subject: "Reset your WBOS password",
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
