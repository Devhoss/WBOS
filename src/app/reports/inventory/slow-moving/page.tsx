import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getSlowMovingItems } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "onHand", label: "On Hand", align: "right", format: "number" },
  { key: "daysSinceLastSale", label: "Days Since Last Sale", align: "right", format: "number" },
  { key: "lastSaleDate", label: "Last Sale Date", align: "left", format: "date" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Slow Moving"
        description="Products with low turnover rates"
        columns={columns}
        fetcher={getSlowMovingItems}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
