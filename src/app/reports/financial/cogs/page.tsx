import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getCogs } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "occurredAt", label: "Date", align: "left", format: "date" },
  { key: "documentNumber", label: "Document", align: "left", format: "string" },
  { key: "movementType", label: "Movement Type", align: "left", format: "string" },
  { key: "classification", label: "Classification", align: "left", format: "string" },
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "quantity", label: "Quantity", align: "right", format: "number" },
  { key: "unitCost", label: "Unit Cost", align: "right", format: "currency" },
  { key: "totalCost", label: "Total Cost", align: "right", format: "currency" },
  { key: "costImpact", label: "COGS Impact", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Cost of Goods Sold"
        description="Sales cost, net of customer returns. Write-offs and internal transfers are excluded."
        columns={columns}
        fetcher={getCogs}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
