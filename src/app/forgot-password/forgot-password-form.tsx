"use client";

import { useState, useTransition } from "react";

import { FormField } from "@/components/form-field";
import { authClient } from "@/infrastructure/auth/auth-client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const email = String(formData.get("email") ?? "").trim();
      if (!email) {
        setMessage("Enter the email address on your account.");
        return;
      }

      // A relative callback is accepted by Better Auth's origin check
      // (allowRelativePaths) and keeps working with CSRF validation enabled,
      // without hardcoding a hostname.
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        setMessage(result.error.message ?? "Unable to send the reset link. Try again.");
        return;
      }

      // Deliberately the same outcome whether or not the address exists —
      // matching the server, which never reveals which emails are registered.
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
          If that email address has a WBOS account, a reset link is on its way. The link expires
          shortly and can only be used once.
        </p>
        <p className="text-sm text-muted-foreground">
          Nothing arrived? Check the spam folder, then try again.
        </p>
        <button
          className="h-10 w-full rounded-md border px-4 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
          onClick={() => setSent(false)}
          type="button"
        >
          Send another link
        </button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormField label="Email" name="email" type="email" autoComplete="email" />
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <button
        className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Sending link..." : "Send reset link"}
      </button>
    </form>
  );
}
