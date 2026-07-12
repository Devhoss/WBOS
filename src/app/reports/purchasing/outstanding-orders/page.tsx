import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getOutstandingOrders } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "poNumber", label: "PO Number", align: "left", format: "string" },
  { key: "supplierName", label: "Supplier", align: "left", format: "string" },
  { key: "status", label: "Status", align: "left", format: "string" },
  { key: "orderedAt", label: "Order Date", align: "left", format: "date" },
  { key: "expectedDeliveryDate", label: "Expected Delivery", align: "left", format: "date" },
  { key: "totalAmount", label: "Total", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Outstanding Orders"
        description="Open purchase orders awaiting receipt or approval"
        columns={columns}
        fetcher={getOutstandingOrders}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={true}
        showSearch={true}
      />
    </AppShell>
  );
}
