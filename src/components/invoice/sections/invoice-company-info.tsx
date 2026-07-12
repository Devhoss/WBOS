import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceCompanyInfo({ branding, language, isRtl }: SectionProps) {
  const align = isRtl ? "text-right" : "text-left";

  return (
    <table className="w-full">
      <tbody>
        <tr>
          <td className={`w-1/2 align-top ${align}`}>
            <div className={isRtl ? "text-right" : "text-left"}>
              <div style={{ fontSize: "19px", fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
                {branding.businessName}
                {branding.arabicBusinessName && language === "bilingual" ? (
                  <span style={{ marginRight: "4px", fontWeight: 600, fontSize: "15px", color: "#4b5563" }}>
                    {" / "}{branding.arabicBusinessName}
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: "8px" }}>
                {branding.address ? <div style={{ marginTop: "3px", color: "#4b5563" }}>{branding.address}</div> : null}
                <div style={{ marginTop: "3px", color: "#4b5563" }}>
                  {[branding.phone, branding.email, branding.website].filter(Boolean).join(" | ")}
                </div>
                <div style={{ marginTop: "3px", color: "#4b5563" }}>
                  {branding.vatNumber ? `${t("vatNumber", language)}: ${branding.vatNumber}` : null}
                  {branding.vatNumber && branding.commercialRegistration ? " | " : null}
                  {branding.commercialRegistration ? `${t("commercialRegistration", language)}: ${branding.commercialRegistration}` : null}
                </div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
