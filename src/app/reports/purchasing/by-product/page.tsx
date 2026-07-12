import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getPurchasesByProduct } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product Name", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "supplier", label: "Supplier", align: "left", format: "string" },
  { key: "totalOrdered", label: "Quantity Ordered", align: "right", format: "number" },
  { key: "totalCost", label: "Total Cost", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Purchases by Product"
        description="Purchase history and costs tracked per product"
        columns={columns}
        fetcher={getPurchasesByProduct}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
