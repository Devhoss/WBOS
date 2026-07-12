import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getReceivingHistory } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "documentNumber", label: "GRN Number", align: "left", format: "string" },
  { key: "poNumber", label: "PO Number", align: "left", format: "string" },
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "quantity", label: "Quantity Received", align: "right", format: "number" },
  { key: "receivedAt", label: "Received Date", align: "left", format: "date" },
  { key: "supplierName", label: "Supplier", align: "left", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Receiving History"
        description="Record of all received shipments and receipts"
        columns={columns}
        fetcher={getReceivingHistory}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
