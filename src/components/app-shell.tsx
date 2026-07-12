import { redirect } from "next/navigation";

import {
  AuthenticatedRequestContextService,
  type AuthenticatedRequestContext,
} from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";

import { AppShellClient } from "./app-shell-client";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let context: AuthenticatedRequestContext;

  try {
    context = await new AuthenticatedRequestContextService().getCurrentContext();
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
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
        <div>
          <p className="text-sm font-medium">{context.organization.name}</p>
          <p className="text-xs text-muted-foreground">Wholesale Operations</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)] px-4 py-6 lg:px-8">{children}</main>
    </AppShellClient>
  );
}
