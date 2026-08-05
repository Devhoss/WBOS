import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { LandedCostForm } from "./landed-cost-form";

export const metadata: Metadata = { title: "New Landed Cost" };

export default async function NewLandedCostPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [suppliers, receipts] = await Promise.all([
    new SupplierRepository().listActive(context.organizationId),
    new LandedCostService().listEligibleReceipts(context),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">New Landed Cost</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Link goods receipts, add expenses (freight, customs, insurance), then allocate them across the received
            lines. Posting revalues on-hand inventory.
          </p>
        </div>

        <LandedCostForm
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          receipts={receipts}
        />
      </div>
    </AppShell>
  );
}
