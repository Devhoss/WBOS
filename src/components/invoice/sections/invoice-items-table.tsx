import { t, type DocTableColumn } from "@/components/document-engine";
import type { InvoiceLine, SectionProps } from "./types";

export function InvoiceItemsTable({ invoice, language }: SectionProps) {
  const columns: DocTableColumn[] = [
    {
      key: "productBarcode",
      label: t("barcode", language),
      width: "12%",
      render: (row) => (
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: "11px", color: "#4b5563", fontVariantNumeric: "tabular-nums" }}>
          {String(row.productBarcode ?? "—")}
        </span>
      ),
    },
    {
      key: "productName",
      label: t("product", language),
      width: "28%",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: "#1f2937" }}>
            {language === "arabic" ? (String(row.productArabicName ?? row.productName)) : String(row.productName)}
            {(row as InvoiceLine).lineType === "FREE_SAMPLE" ? (
              <span style={{
                marginLeft: "6px",
                fontSize: "8px",
                fontWeight: 700,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: "#16a34a",
                borderRadius: "3px",
                padding: "1px 5px",
                lineHeight: 1.4,
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                verticalAlign: "middle",
              }}>
                <span>FREE SAMPLE</span>
                <span style={{ fontSize: "7px", opacity: 0.9 }}>عينة مجانية</span>
              </span>
            ) : null}
          </div>
          {row.productArabicName && language !== "arabic" ? (
            <div style={{ fontSize: "10px", color: "#9ca3af" }}>{String(row.productArabicName)}</div>
          ) : null}
          <div style={{ fontSize: "10px", color: "#9ca3af" }}>
            {String(row.productSku)}
          </div>
        </div>
      ),
    },
    {
      key: "unitOfMeasureCode",
      label: t("unit", language),
      width: "7%",
      align: "center",
      render: (row) => <span style={{ fontSize: "10px", color: "#6b7280" }}>{String(row.unitOfMeasureCode)}</span>,
    },
    {
      key: "piecesPerBox",
      label: t("piecesPerBox", language),
      width: "8%",
      align: "center",
      render: (row) => (Number(row.piecesPerBox) > 0 ? Number(row.piecesPerBox).toFixed(0) : "—"),
    },
    {
      key: "quantity",
      label: t("quantity", language),
      width: "10%",
      align: "right",
      render: (row) => `${Number(row.quantity).toFixed(3)}`,
    },
    {
      key: "unitPrice",
      label: t("unitPrice", language),
      width: "12%",
      align: "right",
      render: (row) => `${Number(row.unitPrice).toFixed(3)}`,
    },
    {
      key: "totalPrice",
      label: t("total", language),
      width: "13%",
      align: "right",
      render: (row) => `${Number(row.totalPrice).toFixed(3)}`,
    },
  ];

  return (
    <div className="document-table">
      <table className="w-full border-collapse" style={{ fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #1f2937", background: "#f3f4f6" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  padding: "8px 6px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#374151",
                  textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, i) => (
            <tr key={i} style={{
              borderBottom: "1px solid #e5e7eb",
              background: i % 2 === 0 ? "white" : "rgba(249,250,251,0.5)",
            }}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "7px 6px",
                    textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                    fontFamily: col.align === "right" ? "'Courier New', monospace" : "inherit",
                  }}
                >
                  {typeof col.render === "function" ? col.render(line as unknown as Record<string, unknown>) : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
