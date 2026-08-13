import { t, type DocTableColumn } from "@/components/document-engine";
import type { InvoiceLine, SectionProps } from "./types";

const numericCell = {
  fontFamily: "'Courier New', monospace",
  fontVariantNumeric: "tabular-nums" as const,
  color: "#111827",
  fontWeight: 700,
};

export function InvoiceItemsTable({ invoice, language }: SectionProps) {
  const columns: DocTableColumn[] = [
    {
      key: "productBarcode",
      label: t("barcode", language),
      width: "12%",
      render: (row) => (
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: "12px", fontWeight: 600, color: "#1f2937", fontVariantNumeric: "tabular-nums" }}>
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
          <div style={{ fontWeight: 700, color: "#111827", fontSize: "12.5px" }}>
            {language === "arabic" ? (String(row.productArabicName ?? row.productName)) : String(row.productName)}
            {(row as InvoiceLine).lineType === "FREE_SAMPLE" ? (
              <span style={{
                marginLeft: "6px",
                fontSize: "8px",
                fontWeight: 600,
                color: "#166534",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "2px",
                padding: "1px 5px",
                lineHeight: 1.3,
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "flex-start",
                verticalAlign: "middle",
              }}>
                <span>FREE SAMPLE</span>
                <span style={{ fontSize: "7px", fontWeight: 500 }}>عينة مجانية</span>
              </span>
            ) : null}
          </div>
          {row.productArabicName && language !== "arabic" ? (
            <div style={{ fontSize: "11px", color: "#6b7280" }}>{String(row.productArabicName)}</div>
          ) : null}
          <div style={{ fontSize: "11px", color: "#6b7280" }}>
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
      render: (row) => <span style={{ fontSize: "11px", color: "#4b5563" }}>{String(row.unitOfMeasureCode)}</span>,
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
      render: (row) => <span style={numericCell}>{`${Number(row.quantity).toFixed(3)}`}</span>,
    },
    {
      key: "unitPrice",
      label: t("unitPrice", language),
      width: "12%",
      align: "right",
      render: (row) => <span style={numericCell}>{`${Number(row.unitPrice).toFixed(3)}`}</span>,
    },
    {
      key: "totalPrice",
      label: t("total", language),
      width: "13%",
      align: "right",
      render: (row) => (
        <span style={{ ...numericCell, fontSize: "13.5px", fontWeight: 800, color: "#0f172a" }}>
          {`${Number(row.totalPrice).toFixed(3)}`}
        </span>
      ),
    },
  ];

  return (
    <div className="document-table">
      <table className="w-full" style={{ fontSize: "12px", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: "#eef1f5" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  padding: "7px 8px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#1f2937",
                  fontSize: "11px",
                  borderBottom: "2px solid #1f2937",
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
              background: i % 2 === 0 ? "white" : "rgba(248,249,251,0.7)",
            }}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #d6dae1",
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
