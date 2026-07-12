"use client";

import { useDocument } from "./document-context";
import { t } from "./document-translations";

export function DocumentFooter() {
  const { branding, language, documentNumber } = useDocument();
  const isRtl = language === "arabic";
  const align = isRtl ? "text-right" : "text-left";

  return (
    <div className="document-footer" dir={isRtl ? "rtl" : "ltr"}>
      {branding.termsAndConditions ? (
        <div className="mb-4">
          <div className={`text-xs font-semibold uppercase tracking-wider text-gray-500 ${align}`}>
            {t("termsAndConditions", language)}
          </div>
          <div className={`mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-700 ${align}`}>
            {branding.termsAndConditions}
          </div>
        </div>
      ) : null}

      <div className="border-t border-gray-300 pt-2">
        <div className={`text-[10px] text-gray-400 ${align}`}>
          {branding.footer || `${branding.businessName} — ${t("invoice", language)} ${documentNumber}`}
        </div>
      </div>
    </div>
  );
}
