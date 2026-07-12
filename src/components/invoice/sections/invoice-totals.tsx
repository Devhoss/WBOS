import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

function TotalsRow({ label, value, bold, border, large, className }: {
  label: string;
  value: string;
  bold?: boolean;
  border?: boolean;
  large?: boolean;
  className?: string;
}) {
  return (
    <tr>
      <td style={{
        padding: "5px 14px 5px 0",
        textAlign: "right",
        fontWeight: bold ? 600 : 400,
        fontSize: large ? "15px" : "inherit",
        color: className ? undefined : "#4b5563",
      }} className={className ?? ""}>
        {border ? <div style={{ borderTop: "2px solid #374151", paddingTop: "6px" }}>{label}</div> : label}
      </td>
      <td style={{
        padding: "5px 0",
        textAlign: "right",
        fontFamily: "'Courier New', monospace",
        fontWeight: bold ? 700 : 400,
        fontSize: large ? "15px" : "inherit",
        color: className ? undefined : "inherit",
      }} className={className ?? ""}>
        {border ? <div style={{ borderTop: "2px solid #374151", paddingTop: "6px" }}>{value}</div> : value}
      </td>
    </tr>
  );
}

export function InvoiceTotals({ invoice, language }: SectionProps) {
  const balance = invoice.totalAmount - invoice.amountPaid;

  return (
    <div className="avoid-break" style={{ display: "flex", justifyContent: "flex-end" }}>
      <table style={{ width: "270px", fontSize: "12px" }}>
        <tbody>
          <TotalsRow label={t("subtotal", language)} value={`${invoice.subtotal.toFixed(3)} ${invoice.currency}`} />
          {invoice.discountAmount > 0 ? (
            <TotalsRow
              label={`${t("discount", language)}${invoice.discountType === "PERCENTAGE" && invoice.discountRate ? ` (${invoice.discountRate.toFixed(2)}%)` : ""}`}
              value={`-${invoice.discountAmount.toFixed(3)} ${invoice.currency}`}
              className="text-red-600"
            />
          ) : null}
          {invoice.taxAmount > 0 ? (
            <TotalsRow label={t("tax", language)} value={`${invoice.taxAmount.toFixed(3)} ${invoice.currency}`} />
          ) : null}
          <TotalsRow label={t("total", language)} value={`${invoice.totalAmount.toFixed(3)} ${invoice.currency}`} bold border large />
          {invoice.amountPaid > 0 ? (
            <TotalsRow label={t("paid", language)} value={`${invoice.amountPaid.toFixed(3)} ${invoice.currency}`} className="text-emerald-600" />
          ) : null}
          {balance > 0 ? (
            <TotalsRow label={t("balance", language)} value={`${balance.toFixed(3)} ${invoice.currency}`} bold large />
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
