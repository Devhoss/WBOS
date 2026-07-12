"use client";

import { useDocument } from "./document-context";
import { t } from "./document-translations";

export function DocumentSignatures() {
  const { language } = useDocument();
  const isRtl = language === "arabic";
  const align = isRtl ? "text-right" : "text-left";

  return (
    <div className="document-signatures" dir={isRtl ? "rtl" : "ltr"}>
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className={`w-1/3 px-2 ${align}`}>
              <div className="border-t border-gray-400 pt-1">
                <div className="text-gray-500">{t("authorizedSignature", language)}</div>
              </div>
            </td>
            <td className={`w-1/3 px-2 ${align}`}>
              <div className="border-t border-gray-400 pt-1">
                <div className="text-gray-500">{t("customerSignature", language)}</div>
              </div>
            </td>
            <td className={`w-1/3 px-2 ${align}`}>
              <div className="border-t border-gray-400 pt-1">
                <div className="text-gray-500">{t("driverSignature", language)}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
