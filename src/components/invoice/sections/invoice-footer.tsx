import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceFooter({ branding, invoice, language, isRtl }: SectionProps) {
  const align = isRtl ? "text-right" : "text-left";

  return (
    <>
      {branding.termsAndConditions ? (
        <div className="avoid-break">
          <div style={{ borderTop: "1px solid #d1d5db", paddingTop: "6px" }}>
            <div style={{ fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#374151" }}
              className={align}>
              {t("termsAndConditions", language)}
            </div>
            <div style={{ marginTop: "3px", whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: 1.5, color: "#374151" }}
              className={align}>
              {branding.termsAndConditions}
            </div>
          </div>
        </div>
      ) : null}

      <div className="avoid-break" style={{ borderTop: "1px solid #d1d5db", paddingTop: "6px", marginTop: "6px" }}>
        <div style={{ fontSize: "11px", color: "#6b7280", lineHeight: 1.5 }} className={align}>
          {branding.footer || `${branding.businessName} — ${invoice.invoiceNumber}`}
        </div>
      </div>
    </>
  );
}
