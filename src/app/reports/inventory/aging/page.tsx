import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getInventoryAging } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "onHand", label: "On Hand", align: "right", format: "number" },
  { key: "lastMovement", label: "Last Movement", align: "left", format: "date" },
  { key: "daysSinceLastMovement", label: "Days Inactive", align: "right", format: "number" },
  { key: "agingBucket", label: "Aging Bucket", align: "left", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Inventory Aging"
        description="Stock categorized by days in warehouse"
        columns={columns}
        fetcher={getInventoryAging}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
