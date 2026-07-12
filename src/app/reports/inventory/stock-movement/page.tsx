import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getStockMovement } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "recordedAt", label: "Date", align: "left", format: "date" },
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "movementType", label: "Movement Type", align: "left", format: "string" },
  { key: "direction", label: "Direction", align: "left", format: "string" },
  { key: "totalQuantity", label: "Quantity", align: "right", format: "number" },
  { key: "reference", label: "Reference", align: "left", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Stock Movement"
        description="Inbound and outbound transaction history"
        columns={columns}
        fetcher={getStockMovement}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
