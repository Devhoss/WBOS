import Link from "next/link";

import { AuthCard } from "@/components/auth-card";

import { ResetPasswordForm } from "./reset-password-form";

/**
 * Landing page for the emailed reset link.
 *
 * Better Auth's callback (`/api/auth/reset-password/:token`) validates the
 * token, then redirects here with `?token=...`, or with `?error=INVALID_TOKEN`
 * when it is unknown or expired.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (error || !token) {
    return (
      <AuthCard
        title="This link is not valid"
        description="Reset links expire and can only be used once."
        footer={{ text: "Need a new link?", label: "Start over", href: "/forgot-password" }}
      >
        <div className="space-y-4">
          <p className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
            This password reset link has expired or has already been used. Request a new one to
            continue.
          </p>
          <Link
            className="flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            href="/forgot-password"
          >
            Request a new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick a password you have not used on this account before."
      footer={{ text: "Changed your mind?", label: "Back to sign in", href: "/sign-in" }}
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
