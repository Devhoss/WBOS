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
                  padding: "8px 14px",
                }}
              >
                <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#374151" }}>
                  {t("customer", language)}
                </div>
                <div style={{ marginTop: "4px", fontSize: "15px", fontWeight: 800, color: "#111827" }}>{invoice.customerName}</div>
                {invoice.customerAddress ? <div style={{ marginTop: "4px", fontSize: "12px", lineHeight: 1.5, color: "#4b5563" }}>{invoice.customerAddress}</div> : null}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
