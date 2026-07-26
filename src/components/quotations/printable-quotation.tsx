"use client";

import { useDocument } from "@/components/document-engine";

type QtLine = {
  lineNumber: number;
  productName: string;
  productArabicName: string | null;
  productSku: string;
  productBarcode: string | null;
  unitOfMeasureCode: string;
  piecesPerBox: number | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type QtData = {
  qtNumber: string;
  customerName: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  terms: string | null;
  lines: QtLine[];
  issueDate: string;
  validUntil: string | null;
};

export function PrintableQuotation({ quotation }: { quotation: QtData }) {
  const { branding, language } = useDocument();
  const isRtl = language === "arabic";
  const dir = isRtl ? "rtl" : "ltr";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} dir={dir}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>{quotation.qtNumber}</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>{quotation.customerName}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "#4b5563" }}>
        <div><span style={{ fontWeight: 600 }}>Date:</span> {new Date(quotation.issueDate).toLocaleDateString()}</div>
        {quotation.validUntil ? <div><span style={{ fontWeight: 600 }}>Valid Until:</span> {new Date(quotation.validUntil).toLocaleDateString()}</div> : null}
        <div><span style={{ fontWeight: 600 }}>Currency:</span> {quotation.currency}</div>
      </div>

      <div style={{ borderTop: "1px solid #d1d5db" }} />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #d1d5db" }}>
            <th style={{ padding: "6px 4px", textAlign: "left", fontWeight: 600, color: "#4b5563" }}>Barcode</th>
            <th style={{ padding: "6px 4px", textAlign: "left", fontWeight: 600, color: "#4b5563" }}>Product</th>
            <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, color: "#4b5563" }}>UOM</th>
            <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, color: "#4b5563" }}>PC/CTN<br /><span style={{ fontWeight: 400 }}>الوحدات / كرتون</span></th>
            <th style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600, color: "#4b5563" }}>Qty</th>
            <th style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600, color: "#4b5563" }}>Unit Price</th>
            <th style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600, color: "#4b5563" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {quotation.lines.map((l) => (
            <tr key={l.lineNumber} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "4px", fontFamily: "monospace", fontSize: "10px", color: "#6b7280" }}>{l.productBarcode ?? "—"}</td>
              <td style={{ padding: "4px" }}>
                {isRtl ? (l.productArabicName ?? l.productName) : l.productName}
                {l.productArabicName && !isRtl ? <div style={{ fontSize: "10px", color: "#9ca3af" }}>{l.productArabicName}</div> : null}
              </td>
              <td style={{ padding: "4px", textAlign: "center", fontSize: "10px", color: "#6b7280" }}>{l.unitOfMeasureCode}</td>
              <td style={{ padding: "4px", textAlign: "center", fontFamily: "monospace", fontSize: "10px", color: "#6b7280" }}>{l.piecesPerBox != null ? l.piecesPerBox.toFixed(0) : "—"}</td>
              <td style={{ padding: "4px", textAlign: "right", fontFamily: "monospace" }}>{l.quantity.toFixed(3)}</td>
              <td style={{ padding: "4px", textAlign: "right", fontFamily: "monospace" }}>{l.unitPrice.toFixed(3)}</td>
              <td style={{ padding: "4px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{l.totalPrice.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px solid #d1d5db", paddingTop: "12px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", fontSize: "12px" }}>
        {quotation.discountAmount > 0 ? (
          <div style={{ display: "flex", gap: "40px" }}>
            <span>Subtotal</span><span style={{ fontFamily: "monospace", minWidth: "80px", textAlign: "right" }}>{quotation.subtotal.toFixed(3)}</span>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: "40px" }}>
          <span style={{ fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "14px", minWidth: "80px", textAlign: "right" }}>{quotation.currency} {quotation.totalAmount.toFixed(3)}</span>
        </div>
      </div>

      {quotation.notes ? (
        <div style={{ fontSize: "12px", color: "#4b5563", borderTop: "1px solid #d1d5db", paddingTop: "12px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Notes</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{quotation.notes}</div>
        </div>
      ) : null}

      {quotation.terms ? (
        <div style={{ fontSize: "12px", color: "#4b5563", borderTop: "1px solid #d1d5db", paddingTop: "12px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Terms</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{quotation.terms}</div>
        </div>
      ) : null}
    </div>
  );
}
