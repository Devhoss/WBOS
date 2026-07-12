import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getBarcodeActivity } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "dateTime", label: "Date/Time", align: "left", format: "date" },
  { key: "product", label: "Product", align: "left", format: "string" },
  { key: "sku", label: "SKU", align: "left", format: "string" },
  { key: "user", label: "User", align: "left", format: "string" },
  { key: "action", label: "Action", align: "left", format: "string" },
  { key: "status", label: "Status", align: "left", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Barcode Activity"
        description="Scan events and barcode usage logs"
        columns={columns}
        fetcher={getBarcodeActivity}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
