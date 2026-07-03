import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth-card";
import { AuthSessionService } from "@/infrastructure/auth/auth-session-service";
import { TenantContextService } from "@/infrastructure/tenancy/tenant-context-service";
import { BusinessError } from "@/shared/errors/business-error";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await new AuthSessionService().getRequiredSession();

  try {
    await new TenantContextService().getRequiredTenantForUser(session.user.id);
    redirect("/");
  } catch (error) {
    if (!(error instanceof BusinessError) || error.code !== "ORGANIZATION_REQUIRED") {
      throw error;
    }
  }

  return (
    <AuthCard
      title="Create organization"
      description="Finish setup by creating the first organization for this WBOS workspace."
      footer={{ text: "Need a different account?", label: "Sign in", href: "/sign-in" }}
    >
      <OnboardingForm />
    </AuthCard>
  );
}
