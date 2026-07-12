import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getPurchasesBySupplier } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "supplierName", label: "Supplier Name", align: "left", format: "string" },
  { key: "orderCount", label: "PO Count", align: "right", format: "number" },
  { key: "totalAmount", label: "Total Amount", align: "right", format: "currency" },
  { key: "avgPoValue", label: "Avg PO Value", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Purchases by Supplier"
        description="Spend and order volume per supplier"
        columns={columns}
        fetcher={getPurchasesBySupplier}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={true}
        showSearch={true}
      />
    </AppShell>
  );
}
