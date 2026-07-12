import { AppShell } from "@/components/app-shell";
import { ReportPageContent } from "../../components/report-page-content";
import { getPaymentRegister } from "@/domains/reports/services/report-actions";
import type { ReportColumn } from "@/domains/reports/dto/report-types";

const columns: ReportColumn[] = [
  { key: "paymentNumber", label: "Payment #", align: "left", format: "string" },
  { key: "paidAt", label: "Date", align: "left", format: "date" },
  { key: "invoiceNumber", label: "Invoice #", align: "left", format: "string" },
  { key: "customerName", label: "Customer", align: "left", format: "string" },
  { key: "method", label: "Method", align: "left", format: "string" },
  { key: "amount", label: "Amount", align: "right", format: "currency" },
  { key: "reference", label: "Reference", align: "left", format: "string" },
];

export default function Page() {
  return (
    <AppShell>
      <ReportPageContent
        title="Payment Register"
        description="Record of all payments received from customers"
        columns={columns}
        fetcher={getPaymentRegister}
        showWarehouse={false}
        showCustomer={true}
        showSupplier={false}
        showSearch={true}
      />
    </AppShell>
  );
}
