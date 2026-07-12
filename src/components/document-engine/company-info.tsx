"use client";

import { useDocument } from "./document-context";
import { t } from "./document-translations";

export function CompanyInfo() {
  const { branding, language } = useDocument();
  const isRtl = language === "arabic";
  const dir = isRtl ? "rtl" : "ltr";
  const align = isRtl ? "text-right" : "text-left";

  if (language === "arabic" && branding.arabicBusinessName) {
    return (
      <div className="company-info" dir={dir}>
        <div className={`text-base font-semibold text-gray-900 ${align}`}>{branding.arabicBusinessName}</div>
        {branding.address && <div className={`mt-1 text-xs text-gray-600 ${align}`}>{branding.address}</div>}
        <div className={`mt-1 text-xs text-gray-600 ${align}`}>
          {[branding.phone, branding.email, branding.website].filter(Boolean).join(" | ")}
        </div>
        <div className={`mt-0.5 text-xs text-gray-600 ${align}`}>
          {branding.vatNumber && `${t("vatNumber", language)}: ${branding.vatNumber}`}
          {branding.vatNumber && branding.commercialRegistration ? " | " : ""}
          {branding.commercialRegistration && `${t("commercialRegistration", language)}: ${branding.commercialRegistration}`}
        </div>
      </div>
    );
  }

  return (
    <div className="company-info" dir={dir}>
      <div className={`text-base font-semibold text-gray-900 ${align}`}>
        {branding.businessName}
        {branding.arabicBusinessName && language === "bilingual" ? (
          <span className="mr-2 font-normal text-gray-500">{branding.arabicBusinessName}</span>
        ) : null}
      </div>
      {branding.address && <div className={`mt-1 text-xs text-gray-600 ${align}`}>{branding.address}</div>}
      <div className={`mt-1 text-xs text-gray-600 ${align}`}>
        {[branding.phone, branding.email, branding.website].filter(Boolean).join(" | ")}
      </div>
      <div className={`mt-0.5 text-xs text-gray-600 ${align}`}>
        {branding.vatNumber && `${t("vatNumber", language)}: ${branding.vatNumber}`}
        {branding.vatNumber && branding.commercialRegistration ? " | " : ""}
        {branding.commercialRegistration && `${t("commercialRegistration", language)}: ${branding.commercialRegistration}`}
      </div>
    </div>
  );
}
