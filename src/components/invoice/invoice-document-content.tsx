import type { BrandingData, LanguageMode } from "@/components/document-engine";
import { t } from "@/components/document-engine";

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

export function InvoiceDocumentContent({
  branding,
  invoice,
  language,
  isRtl,
  showBarcode = false,
}: {
  branding: BrandingData;
  invoice: InvoiceData;
  language: LanguageMode;
  isRtl: boolean;
  showBarcode?: boolean;
}) {
  const sectionProps = { branding, invoice, language, isRtl };

  return (
    <div className="invoice-content" dir={isRtl ? "rtl" : "ltr"}>
      <InvoiceHeader {...sectionProps} />

      <div style={{ borderTop: "1px solid #d1d5db" }} />

      <InvoiceCompanyInfo {...sectionProps} />

      <InvoiceCustomerInfo {...sectionProps} />

      <InvoiceMetadata {...sectionProps} />

      <InvoiceItemsTable {...sectionProps} />

      <InvoiceTotals {...sectionProps} />

      {invoice.notes ? (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4b5563" }}>
            {t("customerNotes", language)}
          </div>
          <div style={{ marginTop: "4px", whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.6, color: "#374151" }}>
            {invoice.notes}
          </div>
        </div>
      ) : null}

      <InvoiceSignatures {...sectionProps} />

      {showBarcode ? (
        <>
          <div style={{ marginTop: "-8px" }} />
          <InvoiceBarcodeSection {...sectionProps} />
        </>
      ) : null}

      <InvoiceFooter {...sectionProps} />
    </div>
  );
}
