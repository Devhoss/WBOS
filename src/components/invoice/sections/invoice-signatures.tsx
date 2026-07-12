import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceSignatures({ language, isRtl }: SectionProps) {
  const align = isRtl ? "text-right" : "text-left";

  return (
    <div className="avoid-break">
      <table className="w-full" style={{ fontSize: "12px" }}>
        <tbody>
          <tr>
            <td className={`w-1/3 px-2 ${align}`}>
              <div style={{ borderTop: "1.5px solid #6b7280", paddingTop: "8px" }}>
                <div style={{ fontWeight: 600, color: "#1f2937", fontSize: "11px" }}>{t("authorizedSignature", language)}</div>
                <div style={{ marginTop: "14px", color: "#6b7280", fontSize: "11px" }}>{t("date", language)}: _________________</div>
              </div>
            </td>
            <td className={`w-1/3 px-2 ${align}`}>
              <div style={{ borderTop: "1.5px solid #6b7280", paddingTop: "8px" }}>
                <div style={{ fontWeight: 600, color: "#1f2937", fontSize: "11px" }}>{t("customerSignature", language)}</div>
                <div style={{ marginTop: "14px", color: "#6b7280", fontSize: "11px" }}>{t("date", language)}: _________________</div>
              </div>
            </td>
            <td className={`w-1/3 px-2 ${align}`}>
              <div style={{ borderTop: "1.5px solid #6b7280", paddingTop: "8px" }}>
                <div style={{ fontWeight: 600, color: "#1f2937", fontSize: "11px" }}>{t("driverSignature", language)}</div>
                <div style={{ marginTop: "14px", color: "#6b7280", fontSize: "11px" }}>{t("date", language)}: _________________</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
