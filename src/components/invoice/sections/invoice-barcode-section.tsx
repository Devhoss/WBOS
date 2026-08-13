import { Barcode } from "@/components/document-engine/barcode";
import { QR } from "@/components/document-engine/qr-code";
import type { SectionProps } from "./types";

export function InvoiceBarcodeSection({ invoice }: SectionProps) {
  return (
    <div
      className="avoid-break"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
        padding: "6px 14px",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563" }}>{invoice.invoiceNumber}</div>
        <Barcode value={invoice.invoiceNumber} height={44} width={1.6} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563" }}>Scan Invoice</div>
        <QR value={`${typeof window !== "undefined" ? window.location.origin : ""}/invoices/${invoice.id}`} size={64} />
      </div>
    </div>
  );
}
