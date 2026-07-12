import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getCurrentStock } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "onHand", label: "On Hand", align: "right", format: "number" },
  { key: "reservedQuantity", label: "Reserved", align: "right", format: "number" },
  { key: "availableQuantity", label: "Available", align: "right", format: "number" },
  { key: "unitCost", label: "Unit Cost", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Current Stock"
        description="Real-time stock levels across all warehouses"
        columns={columns}
        fetcher={getCurrentStock}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
