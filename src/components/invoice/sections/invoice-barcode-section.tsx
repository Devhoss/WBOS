import { t } from "@/components/document-engine";
import { Barcode } from "@/components/document-engine/barcode";
import { QR } from "@/components/document-engine/qr-code";
import type { SectionProps } from "./types";

export function InvoiceBarcodeSection({ invoice, language }: SectionProps) {
  return (
    <div className="avoid-break" style={{ display: "flex", alignItems: "flex-end", gap: "48px", paddingTop: "12px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
        <div style={{ fontSize: "10px", fontWeight: 600, color: "#4b5563" }}>{invoice.invoiceNumber}</div>
        <Barcode value={invoice.invoiceNumber} height={38} width={1.5} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
        <div style={{ fontSize: "10px", fontWeight: 600, color: "#4b5563" }}>{t("scanMe", language)}</div>
        <QR value={`${typeof window !== "undefined" ? window.location.origin : ""}/invoices/${invoice.id}`} size={64} />
      </div>
    </div>
  );
}
