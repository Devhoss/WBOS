import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getSalesByWarehouse } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "warehouseName", label: "Warehouse", align: "left", format: "string" },
  { key: "totalQuantity", label: "Quantity Shipped", align: "right", format: "number" },
  { key: "totalAmount", label: "Total Value", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Sales by Warehouse"
        description="Revenue distribution by warehouse location"
        columns={columns}
        fetcher={getSalesByWarehouse}
        showWarehouse={true}
        showCustomer={false}
        showSupplier={false}
        showSearch={false}
      />
    </AppShell>
  );
}
