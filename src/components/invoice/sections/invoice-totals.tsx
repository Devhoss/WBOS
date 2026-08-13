import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

function TotalsRow({ label, value, bold, border, large, accent, className }: {
  label: string;
  value: string;
  bold?: boolean;
  border?: boolean;
  large?: boolean;
  accent?: "green" | "red";
  className?: string;
}) {
  const color = accent === "green" ? "#047857" : accent === "red" ? "#dc2626" : undefined;
  return (
    <tr>
      <td style={{
        padding: "4px 14px 4px 0",
        textAlign: "right",
        fontWeight: bold ? 700 : 400,
        fontSize: large ? "17px" : "inherit",
        color: className ? undefined : "#374151",
      }} className={className ?? ""}>
        {border ? <div style={{ borderTop: "2.5px solid #111827", paddingTop: "4px" }}>{label}</div> : label}
      </td>
      <td style={{
        padding: "4px 0",
        textAlign: "right",
        fontFamily: "'Courier New', monospace",
        fontWeight: bold ? 800 : 400,
        fontSize: large ? "18px" : "inherit",
        color: color ?? (className ? undefined : "#111827"),
      }} className={className ?? ""}>
        {border ? <div style={{ borderTop: "2.5px solid #111827", paddingTop: "4px" }}>{value}</div> : value}
      </td>
    </tr>
  );
}

export function InvoiceTotals({ invoice, language }: SectionProps) {
  const balance = invoice.totalAmount - invoice.amountPaid;

  return (
    <div className="avoid-break" style={{ display: "flex", justifyContent: "flex-end" }}>
      <table style={{ width: "300px", fontSize: "13px" }}>
        <tbody>
          <TotalsRow label={t("subtotal", language)} value={`${invoice.subtotal.toFixed(3)} ${invoice.currency}`} />
          {invoice.discountAmount > 0 ? (
            <TotalsRow
              label={`${t("discount", language)}${invoice.discountType === "PERCENTAGE" && invoice.discountRate ? ` (${invoice.discountRate.toFixed(2)}%)` : ""}`}
              value={`-${invoice.discountAmount.toFixed(3)} ${invoice.currency}`}
              accent="red"
            />
          ) : null}
          {invoice.taxAmount > 0 ? (
            <TotalsRow label={t("tax", language)} value={`${invoice.taxAmount.toFixed(3)} ${invoice.currency}`} />
          ) : null}
          <TotalsRow label={t("total", language)} value={`${invoice.totalAmount.toFixed(3)} ${invoice.currency}`} bold border large />
          {invoice.amountPaid > 0 ? (
            <TotalsRow label={t("paid", language)} value={`${invoice.amountPaid.toFixed(3)} ${invoice.currency}`} accent="green" bold />
          ) : null}
          {balance > 0 ? (
            <TotalsRow label={t("balance", language)} value={`${balance.toFixed(3)} ${invoice.currency}`} bold />
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
