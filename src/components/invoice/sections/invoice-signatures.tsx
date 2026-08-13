import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceSignatures({ language, isRtl }: SectionProps) {
  const align = isRtl ? "text-right" : "text-left";

  return (
    <div className="avoid-break">
      <table className="w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td className={`w-1/3 px-3 ${align}`} style={{ paddingTop: "8px" }}>
              <div style={{ borderTop: "1.5px solid #9ca3af", paddingTop: "6px" }}>
                <div style={{ fontWeight: 700, color: "#111827", fontSize: "12.5px", letterSpacing: "0.02em" }}>{t("authorizedSignature", language)}</div>
                <div style={{ marginTop: "10px", color: "#6b7280", fontSize: "11.5px" }}>{t("date", language)}: _________________</div>
              </div>
            </td>
            <td className={`w-1/3 px-3 ${align}`} style={{ paddingTop: "8px", borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb" }}>
              <div style={{ borderTop: "1.5px solid #9ca3af", paddingTop: "6px" }}>
                <div style={{ fontWeight: 700, color: "#111827", fontSize: "12.5px", letterSpacing: "0.02em" }}>{t("customerSignature", language)}</div>
                <div style={{ marginTop: "10px", color: "#6b7280", fontSize: "11.5px" }}>{t("date", language)}: _________________</div>
              </div>
            </td>
            <td className={`w-1/3 px-3 ${align}`} style={{ paddingTop: "8px" }}>
              <div style={{ borderTop: "1.5px solid #9ca3af", paddingTop: "6px" }}>
                <div style={{ fontWeight: 700, color: "#111827", fontSize: "12.5px", letterSpacing: "0.02em" }}>{t("driverSignature", language)}</div>
                <div style={{ marginTop: "10px", color: "#6b7280", fontSize: "11.5px" }}>{t("date", language)}: _________________</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
