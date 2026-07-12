import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getShipmentStatus } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "shipmentNumber", label: "Shipment #", align: "left", format: "string" },
  { key: "salesOrderNumber", label: "SO #", align: "left", format: "string" },
  { key: "customer", label: "Customer", align: "left", format: "string" },
  { key: "status", label: "Status", align: "left", format: "string" },
  { key: "warehouse", label: "Warehouse", align: "left", format: "string" },
  { key: "itemsCount", label: "Items Count", align: "right", format: "number" },
  { key: "createdDate", label: "Created Date", align: "left", format: "date" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Shipment Status"
        description="Real-time tracking of outbound shipments"
        columns={columns}
        fetcher={getShipmentStatus}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
