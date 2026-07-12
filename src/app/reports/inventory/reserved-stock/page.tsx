import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getReservedStock } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "reservedQuantity", label: "Reserved Qty", align: "right", format: "number" },
  { key: "shipmentRef", label: "Shipment Ref", align: "left", format: "string" },
  { key: "status", label: "Status", align: "left", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Reserved Stock"
        description="Inventory allocated to open orders"
        columns={columns}
        fetcher={getReservedStock}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
