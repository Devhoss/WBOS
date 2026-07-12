import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceFooter({ branding, invoice, language, isRtl }: SectionProps) {
  const align = isRtl ? "text-right" : "text-left";

  return (
    <>
      {branding.termsAndConditions ? (
        <div className="avoid-break">
          <div style={{ borderTop: "1px solid #d1d5db", paddingTop: "10px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4b5563" }}
              className={align}>
              {t("termsAndConditions", language)}
            </div>
            <div style={{ marginTop: "4px", whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: 1.5, color: "#374151" }}
              className={align}>
              {branding.termsAndConditions}
            </div>
          </div>
        </div>
      ) : null}

      <div className="avoid-break" style={{ borderTop: "1px solid #d1d5db", paddingTop: "8px", marginTop: "8px" }}>
        <div style={{ fontSize: "10px", color: "#6b7280" }} className={align}>
          {branding.footer || `${branding.businessName} — ${invoice.invoiceNumber}`}
        </div>
      </div>
    </>
  );
}
