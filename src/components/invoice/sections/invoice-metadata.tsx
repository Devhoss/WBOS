import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

function MetadataRow({ label, value, rtl }: { label: string; value: string; rtl: boolean }) {
  return (
    <tr>
      <td style={{ width: "40%", paddingBottom: "4px", paddingRight: "12px", color: "#4b5563" }}
        className={rtl ? "text-right" : "text-left"}>
        {label}
      </td>
      <td style={{ width: "60%", paddingBottom: "4px", fontWeight: 600, color: "#111827" }}
        className={rtl ? "text-left" : "text-right"}>
        {value}
      </td>
    </tr>
  );
}

export function InvoiceMetadata({ invoice, language, isRtl }: SectionProps) {
  return (
    <table className="w-full border-collapse text-xs">
      <tbody>
        <tr>
          <td className="w-1/2 align-top pr-2">
            <table className="w-full">
              <tbody>
                <MetadataRow label={t("invoiceNumber", language)} value={invoice.invoiceNumber} rtl={isRtl} />
                <MetadataRow label={t("date", language)} value={invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : "-"} rtl={isRtl} />
                <MetadataRow label={t("salesOrder", language)} value={invoice.salesOrder.soNumber} rtl={isRtl} />
                <MetadataRow label={t("warehouse", language)} value={invoice.warehouseName ?? "-"} rtl={isRtl} />
                <MetadataRow label={t("deliveryStatus", language)} value={invoice.deliveryStatus ?? "-"} rtl={isRtl} />
              </tbody>
            </table>
          </td>
          <td className="w-1/2 align-top pl-2">
            <table className="w-full">
              <tbody>
                <MetadataRow label={t("dueDate", language)} value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"} rtl={isRtl} />
                <MetadataRow label={t("paymentTerms", language)} value={invoice.paymentTerms ?? "-"} rtl={isRtl} />
                <MetadataRow label={t("currency", language)} value={invoice.currency} rtl={isRtl} />
                <MetadataRow label={t("status", language)} value={invoice.status.replace(/_/g, " ")} rtl={isRtl} />
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
