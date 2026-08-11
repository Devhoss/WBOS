import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ReportLayout } from "@/app/reports/components/report-layout";
import { ErrorBoundary } from "@/app/error-boundary";
import { getCachedContext } from "@/infrastructure/request/authenticated-request-context";

import { ExecutiveService } from "./executive-service";
import { ProfitabilityPanel } from "./profitability-panel";
import { ReceivablesPanel } from "./receivables-panel";
import { InventoryPanel } from "./inventory-panel";
import { PurchasingPanel } from "./purchasing-panel";
import { SalesContextPanel } from "./sales-context-panel";
import { ExecutiveSkeleton } from "./executive-skeleton";

export const metadata: Metadata = { title: "Executive Summary" };

export default function Page() {
  return (
    <AppShell>
      <ReportLayout
        title="Executive Summary"
        description="Key financial and operational metrics at a glance"
      >
        <ErrorBoundary>
          <Suspense fallback={<ExecutiveSkeleton />}>
            <ExecutiveDashboard />
          </Suspense>
        </ErrorBoundary>
      </ReportLayout>
    </AppShell>
  );
}

async function ExecutiveDashboard() {
  const context = await getCachedContext();
  const data = await new ExecutiveService().getSummary(context.organizationId);

  return (
    <div className="space-y-8">
      <ProfitabilityPanel data={data.profitability} />
      <ReceivablesPanel data={data.receivables} />
      <InventoryPanel data={data.inventory} />
      <PurchasingPanel data={data.purchasing} />
      <SalesContextPanel data={data.salesContext} />
    </div>
  );
}
