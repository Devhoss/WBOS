"use client";

import { useDocument } from "./document-context";
import { t } from "./document-translations";

type CustomerInfoProps = {
  customerName: string;
  customerAddress?: string | null;
  customerVat?: string | null;
  customerPhone?: string | null;
};

export function CustomerInfo({ customerName, customerAddress, customerVat, customerPhone }: CustomerInfoProps) {
  const { language } = useDocument();
  const isRtl = language === "arabic";
  const align = isRtl ? "text-right" : "text-left";

  return (
    <div className="customer-info" dir={isRtl ? "rtl" : "ltr"}>
      <div className={`text-xs font-semibold uppercase tracking-wider text-gray-500 ${align}`}>
        {t("customer", language)}
      </div>
      <div className={`mt-1 text-sm font-semibold text-gray-900 ${align}`}>{customerName}</div>
      {customerAddress ? <div className={`text-xs text-gray-600 ${align}`}>{customerAddress}</div> : null}
      {customerPhone ? <div className={`text-xs text-gray-600 ${align}`}>{customerPhone}</div> : null}
      {customerVat ? <div className={`text-xs text-gray-600 ${align}`}>{t("vatNumber", language)}: {customerVat}</div> : null}
    </div>
  );
}
