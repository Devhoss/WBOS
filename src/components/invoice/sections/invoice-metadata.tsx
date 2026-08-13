import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

function MetadataRow({ label, value, rtl, strong = false }: { label: string; value: string; rtl: boolean; strong?: boolean }) {
  return (
    <tr>
      <td style={{ width: "40%", paddingBottom: "1px", paddingRight: "12px", color: "#6b7280", fontSize: "11.5px", fontWeight: 600 }}
        className={rtl ? "text-right" : "text-left"}>
        {label}
      </td>
      <td style={{
        width: "60%",
        paddingBottom: "1px",
        fontWeight: strong ? 800 : 700,
        color: strong ? "#111827" : "#1f2937",
        fontSize: strong ? "13px" : "12px",
        fontFamily: strong ? "'Courier New', monospace" : "inherit",
        fontVariantNumeric: strong ? "tabular-nums" : "inherit",
      }}
        className={rtl ? "text-left" : "text-right"}>
        {value}
      </td>
    </tr>
  );
}

function StatusBadge({ status, rtl }: { status: string; rtl: boolean }) {
  const normalized = status.replace(/_/g, " ");
  const isIssued = status.toUpperCase() === "ISSUED";
  return (
    <span
      className={rtl ? "text-left" : "text-right"}
      style={{
        display: "inline-block",
        fontSize: "12px",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "3px 10px",
        borderRadius: "9999px",
        border: "1px solid",
        ...(isIssued
          ? { color: "#166534", background: "#ecfdf5", borderColor: "#bbf7d0" }
          : { color: "#1f2937", background: "#f3f4f6", borderColor: "#d1d5db" }),
      }}
    >
      {normalized}
    </span>
  );
}

export function InvoiceMetadata({ invoice, language, isRtl }: SectionProps) {
  return (
    <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
      <tbody>
        <tr>
          <td className="w-1/2 align-top pr-3">
            <table className="w-full">
              <tbody>
                <MetadataRow label={t("invoiceNumber", language)} value={invoice.invoiceNumber} rtl={isRtl} strong />
                <MetadataRow label={t("date", language)} value={invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : "-"} rtl={isRtl} />
                <MetadataRow label={t("salesOrder", language)} value={invoice.salesOrder.soNumber} rtl={isRtl} strong />
                <MetadataRow label={t("warehouse", language)} value={invoice.warehouseName ?? "-"} rtl={isRtl} />
                <MetadataRow label={t("deliveryStatus", language)} value={invoice.deliveryStatus ?? "-"} rtl={isRtl} />
              </tbody>
            </table>
          </td>
          <td className="w-1/2 align-top pl-3">
            <table className="w-full">
              <tbody>
                {invoice.dueDate ? <MetadataRow label={t("dueDate", language)} value={new Date(invoice.dueDate).toLocaleDateString()} rtl={isRtl} /> : null}
                <MetadataRow label={t("paymentTerms", language)} value={invoice.paymentTerms ?? "-"} rtl={isRtl} />
                <MetadataRow label={t("currency", language)} value={invoice.currency} rtl={isRtl} strong />
                <tr>
                  <td style={{ width: "40%", paddingBottom: "1px", paddingRight: "12px", color: "#6b7280", fontSize: "11.5px", fontWeight: 600 }}
                    className={isRtl ? "text-right" : "text-left"}>
                    {t("status", language)}
                  </td>
                  <td className={isRtl ? "text-left" : "text-right"} style={{ width: "60%", paddingBottom: "1px" }}>
                    <StatusBadge status={invoice.status} rtl={isRtl} />
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
