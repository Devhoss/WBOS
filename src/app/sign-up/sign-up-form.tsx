"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/form-field";
import { completeOnboarding } from "@/domains/organization/actions/complete-onboarding";
import { authClient } from "@/infrastructure/auth/auth-client";

export function SignUpForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const organizationName = String(formData.get("organizationName") ?? "");

      const signUpResult = await authClient.signUp.email({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      if (signUpResult.error) {
        setMessage(signUpResult.error.message ?? "Unable to create account.");
        return;
      }

      const onboardingResult = await completeOnboarding({ organizationName });

      if (!onboardingResult.ok) {
        setMessage(onboardingResult.message ?? "Unable to complete onboarding.");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormField label="Your name" name="name" autoComplete="name" />
      <FormField label="Email" name="email" type="email" autoComplete="email" />
      <FormField label="Password" name="password" type="password" autoComplete="new-password" />
      <FormField label="Organization name" name="organizationName" autoComplete="organization" />
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <button
        className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
