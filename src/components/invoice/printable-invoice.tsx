"use client";

import { Download, Printer } from "lucide-react";
import { useCallback } from "react";

import {
  DocumentProvider,
  t,
  useDocument,
  type BrandingData,
} from "@/components/document-engine";

import {
  InvoiceHeader,
  InvoiceCompanyInfo,
  InvoiceCustomerInfo,
  InvoiceMetadata,
  InvoiceItemsTable,
  InvoiceTotals,
  InvoiceSignatures,
  InvoiceBarcodeSection,
  InvoiceFooter,
  type InvoiceData,
} from "./sections";

function InvoiceDocument({ invoice }: { invoice: InvoiceData }) {
  const { branding, language } = useDocument();
  const isRtl = language === "arabic";
  const dir = isRtl ? "rtl" : "ltr";

  const sectionProps = { branding, invoice, language, isRtl };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "0" }} dir={dir}>
      <InvoiceHeader {...sectionProps} />

      <div style={{ borderTop: "1px solid #d1d5db" }} />

      <InvoiceCompanyInfo {...sectionProps} />

      <InvoiceCustomerInfo {...sectionProps} />

      <InvoiceMetadata {...sectionProps} />

      <InvoiceItemsTable {...sectionProps} />

      <InvoiceTotals {...sectionProps} />

      {invoice.notes ? (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4b5563" }}
            className={isRtl ? "text-right" : "text-left"}>
            {t("customerNotes", language)}
          </div>
          <div style={{ marginTop: "4px", whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.6, color: "#374151" }}>
            {invoice.notes}
          </div>
        </div>
      ) : null}

      <InvoiceSignatures {...sectionProps} />
      <div style={{ marginTop: "-8px" }} />

      <InvoiceBarcodeSection {...sectionProps} />

      <InvoiceFooter {...sectionProps} />
    </div>
  );
}

export function PrintableInvoice({
  branding,
  invoice,
  showActions = true,
}: {
  branding: BrandingData;
  invoice: InvoiceData;
  showActions?: boolean;
}) {
  const handlePrint = useCallback(() => {
    window.open(`/invoices/${invoice.id}/print`, "_blank");
  }, [invoice.id]);

  const handleDownloadPdf = useCallback(async () => {
    const a = document.createElement("a");
    a.href = `/api/invoices/${invoice.id}/pdf`;
    a.download = `${invoice.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [invoice.id, invoice.invoiceNumber]);

  return (
    <DocumentProvider
      branding={branding}
      documentTitle={t("invoice", branding.documentLanguage as "english" | "arabic" | "bilingual")}
      documentNumber={invoice.invoiceNumber}
    >
      {showActions ? (
        <div className="no-print mb-4 flex items-center gap-3 border-b pb-4">
          <button
            onClick={handlePrint}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-800 px-4 text-sm font-medium text-white hover:bg-gray-700"
          >
            <Printer className="size-4" />
            Print
          </button>
          <button
            onClick={handleDownloadPdf}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            <Download className="size-4" />
            Download PDF
          </button>
        </div>
      ) : null}

      <div className="bg-white" style={{ padding: "0" }}>
        <InvoiceDocument invoice={invoice} />
      </div>
    </DocumentProvider>
  );
}
