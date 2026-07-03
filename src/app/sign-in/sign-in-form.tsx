"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/form-field";
import { authClient } from "@/infrastructure/auth/auth-client";

export function SignInForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const result = await authClient.signIn.email({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        rememberMe: true,
      });

      if (result.error) {
        setMessage(result.error.message ?? "Unable to sign in.");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormField label="Email" name="email" type="email" autoComplete="email" />
      <FormField label="Password" name="password" type="password" autoComplete="current-password" />
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <button
        className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
