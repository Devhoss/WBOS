"use client";

import { useDocument } from "@/components/document-engine";

type SOLine = {
  lineNumber: number;
  productName: string;
  productSku: string;
  unitOfMeasureCode: string;
  orderedQuantity: number;
  shippedQuantity: number;
  returnedQuantity: number;
  unitPrice: number;
  totalPrice: number;
};

type SOData = {
  soNumber: string;
  customerName: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  lines: SOLine[];
  createdAt: string;
  expectedShipDate: string | null;
  deliveryAddress: string | null;
};

export function PrintableSalesOrder({ order }: { order: SOData }) {
  const { branding, language } = useDocument();
  const isRtl = language === "arabic";
  const dir = isRtl ? "rtl" : "ltr";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} dir={dir}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>{order.soNumber}</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>{order.customerName}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "#4b5563" }}>
        <div><span style={{ fontWeight: 600 }}>Date:</span> {new Date(order.createdAt).toLocaleDateString()}</div>
        {order.expectedShipDate ? <div><span style={{ fontWeight: 600 }}>Expected Ship:</span> {new Date(order.expectedShipDate).toLocaleDateString()}</div> : null}
        <div><span style={{ fontWeight: 600 }}>Currency:</span> {order.currency}</div>
      </div>

      {order.deliveryAddress ? (
        <div style={{ fontSize: "12px", color: "#4b5563" }}>
          <span style={{ fontWeight: 600 }}>Delivery Address:</span> {order.deliveryAddress}
        </div>
      ) : null}

      <div style={{ borderTop: "1px solid #d1d5db" }} />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #d1d5db" }}>
            <th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600, color: "#4b5563" }}>#</th>
            <th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600, color: "#4b5563" }}>Product</th>
            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, color: "#4b5563" }}>Qty</th>
            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600, color: "#4b5563" }}>Unit Price</th>
            <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600, color: "#4b5563" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.lineNumber} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "6px", color: "#6b7280" }}>{l.lineNumber}</td>
              <td style={{ padding: "6px" }}>
                {l.productName}
                <span style={{ marginLeft: "6px", fontFamily: "monospace", fontSize: "11px", color: "#9ca3af" }}>{l.productSku}</span>
                <span style={{ marginLeft: "4px", fontSize: "11px", color: "#9ca3af" }}>({l.unitOfMeasureCode})</span>
              </td>
              <td style={{ padding: "6px", textAlign: "center" }}>{l.orderedQuantity.toFixed(3)}</td>
              <td style={{ padding: "6px", textAlign: "right", fontFamily: "monospace" }}>{l.unitPrice.toFixed(3)}</td>
              <td style={{ padding: "6px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{l.totalPrice.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px solid #d1d5db", paddingTop: "12px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", fontSize: "12px" }}>
        {order.discountAmount > 0 ? (
          <div style={{ display: "flex", gap: "40px" }}>
            <span>Subtotal</span><span style={{ fontFamily: "monospace", minWidth: "80px", textAlign: "right" }}>{order.subtotal.toFixed(3)}</span>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: "40px" }}>
          <span style={{ fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "14px", minWidth: "80px", textAlign: "right" }}>{order.currency} {order.totalAmount.toFixed(3)}</span>
        </div>
      </div>

      {order.notes ? (
        <div style={{ fontSize: "12px", color: "#4b5563", borderTop: "1px solid #d1d5db", paddingTop: "12px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Notes</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{order.notes}</div>
        </div>
      ) : null}
    </div>
  );
}
