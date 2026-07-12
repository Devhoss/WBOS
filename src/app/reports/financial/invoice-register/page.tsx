import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getInvoiceRegister } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "invoiceNumber", label: "Invoice #", align: "left", format: "string" },
  { key: "issuedAt", label: "Date", align: "left", format: "date" },
  { key: "customerName", label: "Customer", align: "left", format: "string" },
  { key: "status", label: "Status", align: "left", format: "string" },
  { key: "totalAmount", label: "Total", align: "right", format: "currency" },
  { key: "amountPaid", label: "Paid", align: "right", format: "currency" },
  { key: "balanceDue", label: "Balance", align: "right", format: "currency" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Invoice Register"
        description="Complete list of issued sales invoices"
        columns={columns}
        fetcher={getInvoiceRegister}
        showWarehouse={false}
        showCustomer={true}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
