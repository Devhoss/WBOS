import { t, type DocTableColumn } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceItemsTable({ invoice, language }: SectionProps) {
  const columns: DocTableColumn[] = [
    {
      key: "lineNumber",
      label: t("line", language),
      width: "5%",
      align: "center",
      render: (row) => String(row.lineNumber),
    },
    {
      key: "productName",
      label: t("product", language),
      width: "32%",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: "#1f2937" }}>{String(row.productName)}</div>
          <div style={{ fontSize: "10px", color: "#6b7280" }}>{String(row.productSku)}</div>
        </div>
      ),
    },
    {
      key: "quantity",
      label: t("quantity", language),
      width: "8%",
      align: "right",
      render: (row) => `${Number(row.quantity).toFixed(3)} ${String(row.unitOfMeasureCode)}`,
    },
    {
      key: "piecesPerBox",
      label: t("piecesPerBox", language),
      width: "8%",
      align: "right",
      render: (row) => (Number(row.piecesPerBox) > 0 ? Number(row.piecesPerBox).toFixed(0) : "-"),
    },
    {
      key: "unitPrice",
      label: t("unitPrice", language),
      width: "13%",
      align: "right",
      render: (row) => `${Number(row.unitPrice).toFixed(3)}`,
    },
    {
      key: "totalPrice",
      label: t("netPrice", language),
      width: "14%",
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
