import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getNegativeStock } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "netQuantity", label: "Current Balance", align: "right", format: "number" },
  { key: "lastMovementDate", label: "Last Movement Date", align: "left", format: "date" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Negative Stock"
        description="Stock discrepancies where on-hand is below zero"
        columns={columns}
        fetcher={getNegativeStock}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
