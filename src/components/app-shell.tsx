import { redirect } from "next/navigation";

import {
  getCachedContext,
  type AuthenticatedRequestContext,
} from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";

import { AppShellClient } from "./app-shell-client";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let context: AuthenticatedRequestContext;

  try {
    context = await getCachedContext();
  } catch (error) {
    if (error instanceof BusinessError) {
      if (error.code === "ORGANIZATION_REQUIRED") {
        redirect("/onboarding");
      }

      redirect("/sign-in");
    }

    throw error;
  }

  const settings = await new BusinessSettingsRepository().findByOrganizationId(
    context.organizationId,
  );

  return (
    <AppShellClient
      organizationName={context.organization.name}
      logoPath={settings?.logoPath}
    >
      {children}
    </AppShellClient>
  );
}
