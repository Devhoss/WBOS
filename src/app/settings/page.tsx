import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { BusinessSettingsService } from "@/domains/settings/services/business-settings-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Business Settings" };

export default async function SettingsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const settings = await new BusinessSettingsService().getForContext(context);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Business Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage organization-wide defaults used by future documents, workflows, and reports.
          </p>
        </div>

        <SettingsForm settings={settings} />
      </div>
    </AppShell>
  );
}
