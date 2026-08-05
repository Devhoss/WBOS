import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { LandedCostTable } from "./landed-cost-table";

export const metadata: Metadata = { title: "Landed Costs" };

export default async function LandedCostsPage(props: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const status = searchParams?.status || undefined;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const result = await new LandedCostService().list(context, { status, take: 100 });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Landed Costs</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Revalue received inventory for freight, customs, and other costs. Allocate expenses across goods receipts
            and post to inventory valuation.
          </p>
        </div>

        <LandedCostTable
          landedCosts={result.items.map((lc) => ({
            id: lc.id,
            lcNumber: lc.lcNumber,
            status: lc.status,
            supplierName: lc.supplier?.name ?? "—",
            totalExpense: lc.expenses.reduce((sum, e) => sum + Number(e.baseAmount), 0),
            currency: lc.currency,
            lineCount: lc.lines.length,
            receiptCount: lc.receipts.length,
            postedBy: lc.postedBy?.name ?? null,
            postingDate: lc.postingDate?.toISOString() ?? null,
            createdAt: lc.createdAt.toISOString(),
          }))}
          total={result.total}
        />
      </div>
    </AppShell>
  );
}
