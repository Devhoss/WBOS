import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceCustomerInfo({ invoice, language }: SectionProps) {
  return (
    <table className="w-full">
      <tbody>
        <tr>
          <td className="w-1/2 align-top" />
          <td className="w-1/2 align-top">
              <div
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  background: "#f9fafb",
                  padding: "14px 18px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4b5563" }}>
                  {t("customer", language)}
                </div>
                <div style={{ marginTop: "6px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>{invoice.customerName}</div>
                {invoice.customerAddress ? <div style={{ marginTop: "4px", fontSize: "12px", color: "#4b5563" }}>{invoice.customerAddress}</div> : null}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
