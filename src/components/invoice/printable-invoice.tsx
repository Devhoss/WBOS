"use client";

import { Download, Printer } from "lucide-react";
import { useCallback } from "react";

import {
  DocumentProvider,
  t,
  type BrandingData,
} from "@/components/document-engine";

import type { InvoiceData } from "./sections";

import { InvoiceDocumentContent } from "./invoice-document-content";

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

  const languageMode = branding.documentLanguage as "english" | "arabic" | "bilingual";
  const isRtl = languageMode === "arabic";

  return (
    <DocumentProvider
      branding={branding}
      documentTitle={t("invoice", languageMode)}
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
        <InvoiceDocumentContent
          branding={branding}
          invoice={invoice}
          language={languageMode}
          isRtl={isRtl}
          showBarcode
        />
      </div>
    </DocumentProvider>
  );
}
