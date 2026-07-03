"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/form-field";
import { completeOnboarding } from "@/domains/organization/actions/complete-onboarding";

export function OnboardingForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const result = await completeOnboarding({
        organizationName: String(formData.get("organizationName") ?? ""),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to complete onboarding.");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormField label="Organization name" name="organizationName" autoComplete="organization" />
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <button
        className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Creating organization..." : "Create organization"}
      </button>
    </form>
  );
}
