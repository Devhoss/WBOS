import { ClipboardPlus, Plus } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { statusColorClass, formatStatus } from "@/components/status-colors";
import { CycleCountRepository } from "@/domains/inventory/repositories/cycle-count-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export const metadata: Metadata = { title: "Cycle Counts" };

export default async function CycleCountsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const { data: counts } = await new CycleCountRepository().listByOrganization(context.organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Cycle Counts</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Count inventory to reconcile physical stock against system quantities. Counts must be completed and then approved to post adjustments.
              </p>
            </div>
            <Link
              href="/inventory/cycle-counts/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="size-4" /> New Count
            </Link>
          </div>
        </div>

        {counts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardPlus className="size-12 text-muted-foreground/40" />
            <h2 className="mt-4 text-sm font-semibold">No cycle counts yet</h2>
            <p className="mt-1 text-xs text-muted-foreground">Create a cycle count to start reconciling inventory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="h-10 px-4 text-left">Count #</th>
                  <th className="h-10 px-4 text-left">Warehouse</th>
                  <th className="h-10 px-4 text-center">Lines</th>
                  <th className="h-10 px-4 text-center">Status</th>
                  <th className="h-10 px-4 text-left">Counted By</th>
                  <th className="h-10 px-4 text-right">Created</th>
                  <th className="h-10 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((count) => (
                  <tr key={count.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="h-12 px-4">
                      <Link href={`/inventory/cycle-counts/${count.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        {count.countNumber}
                      </Link>
                    </td>
                    <td className="h-12 px-4 text-muted-foreground">{count.warehouse.name}</td>
                    <td className="h-12 px-4 text-center font-mono tabular-nums">{count._count.lines}</td>
                    <td className="h-12 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColorClass(count.status)}`}>
                        {formatStatus(count.status)}
                      </span>
                    </td>
                    <td className="h-12 px-4">{count.countedBy?.name ?? "-"}</td>
                    <td className="h-12 px-4 text-right font-mono tabular-nums text-muted-foreground">
                      {new Date(count.createdAt).toLocaleDateString()}
                    </td>
                    <td className="h-12 px-4 text-right">
                      <Link
                        href={`/inventory/cycle-counts/${count.id}`}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
