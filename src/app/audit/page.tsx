import { AppShell } from "@/components/app-shell";
import { AuditClient } from "./audit-client";

export const metadata = { title: "Audit Log" };

export default function AuditPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Audit Log</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Chronological record of all system activity. Read-only.
          </p>
        </div>
        <AuditClient />
      </div>
    </AppShell>
  );
}
