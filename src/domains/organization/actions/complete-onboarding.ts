"use server";

import { z } from "zod";

import { OnboardingService } from "@/domains/organization/services/onboarding-service";
import { AuthSessionService } from "@/infrastructure/auth/auth-session-service";
import { BusinessError } from "@/shared/errors/business-error";

const completeOnboardingSchema = z.object({
  organizationName: z.string().trim().min(2, "Organization name is required.").optional().default(""),
});

export async function completeOnboarding(input: unknown) {
  const parsed = completeOnboardingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid onboarding details.",
    };
  }

  try {
    const session = await new AuthSessionService().getRequiredSession();

    await new OnboardingService().completeFirstOrganization({
      userId: session.user.id,
      organizationName: parsed.data.organizationName,
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      return {
        ok: false,
        message: error.message,
      };
    }

    throw error;
  }

  return { ok: true };
}
