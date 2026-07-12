import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getSalesByProduct } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "productName", label: "Product Name", align: "left", format: "string" },
  { key: "productSku", label: "SKU", align: "left", format: "string" },
  { key: "totalQuantity", label: "Quantity Sold", align: "right", format: "number" },
  { key: "totalAmount", label: "Total Sales", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Sales by Product"
        description="Revenue and units sold per product"
        columns={columns}
        fetcher={getSalesByProduct}
        showWarehouse={false}
        showCustomer={false}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
