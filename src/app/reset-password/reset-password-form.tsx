"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/form-field";
import { authClient } from "@/infrastructure/auth/auth-client";

/** Better Auth's default minimum (`emailAndPassword.minPasswordLength`). */
const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setMessage("The two passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await authClient.resetPassword({ newPassword: password, token });

      if (result.error) {
        setMessage(
          result.error.message ??
            "This reset link is no longer valid. Request a new one and try again.",
        );
        return;
      }

      // Every existing session was revoked server-side
      // (revokeSessionsOnPasswordReset), so the user signs in fresh.
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 1200);
    });
  }

  if (done) {
    return (
      <p className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
        Your password has been changed and you have been signed out everywhere. Redirecting you to
        sign in...
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
      />
      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
      />
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <button
        className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
