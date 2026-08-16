import { AuthCard } from "@/components/auth-card";
import { isEmailEnabled } from "@/infrastructure/email/config";

import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Must be rendered per request, not prerendered.
 *
 * `isEmailEnabled()` reads WBOS_SMTP_HOST from the environment. Without this,
 * Next.js statically prerenders the page at BUILD time — when SMTP is never
 * configured — and bakes "password recovery is not available" into the image.
 * The page would then keep saying recovery is unavailable no matter how SMTP is
 * configured at runtime.
 */
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  // Rendered on the server so a deployment without SMTP tells people the truth
  // up front, rather than accepting the request and leaving them waiting for an
  // email that will never arrive.
  const emailEnabled = isEmailEnabled();

  return (
    <AuthCard
      title="Reset your password"
      description={
        emailEnabled
          ? "Enter your email and we will send you a link to choose a new password."
          : "Password recovery by email is not available on this deployment."
      }
      footer={{ text: "Remembered it?", label: "Back to sign in", href: "/sign-in" }}
    >
      {emailEnabled ? (
        <ForgotPasswordForm />
      ) : (
        <p className="rounded-md border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
          This WBOS instance has no mail server configured, so reset links cannot be sent. Ask an
          administrator to reset your password directly.
        </p>
      )}
    </AuthCard>
  );
}
