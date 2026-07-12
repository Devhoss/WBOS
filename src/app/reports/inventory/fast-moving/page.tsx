import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getFastMovingItems } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "movementInPeriod", label: "Quantity Sold (30d)", align: "right", format: "number" },
  { key: "turnoverRate", label: "Turnover Rate", align: "right", format: "number" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Fast Moving"
        description="High-velocity products with frequent turnover"
        columns={columns}
        fetcher={getFastMovingItems}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
