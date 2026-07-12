"use client";

import { useDocument } from "./document-context";

export function DocumentHeader({ logoUrl }: { logoUrl?: string | null }) {
  const { branding, language, documentTitle, documentNumber } = useDocument();
  const isRtl = language === "arabic";
  const dir = isRtl ? "rtl" : "ltr";

  return (
    <div className="document-header" dir={dir}>
      <table className="w-full">
        <tbody>
          <tr>
            <td className="w-1/3 align-middle">
              {logoUrl || branding.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- used in PDF/print context where next/image may interfere with Chromium rendering
                <img
                  src={logoUrl ?? `/${branding.logoPath}`}
                  alt={branding.businessName}
                  className="max-h-20 max-w-48 object-contain"
                />
              ) : (
                <div className="text-lg font-bold tracking-tight text-gray-900">
                  {branding.businessName}
                </div>
              )}
            </td>
            <td className="w-2/3 text-right align-middle" dir="ltr">
              <div className="text-2xl font-bold text-gray-900">
                {documentTitle}
              </div>
              <div className="mt-0.5 text-sm text-gray-500">
                {isRtl ? `${documentNumber} :رقم` : `#${documentNumber}`}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 border-t border-gray-300" />
    </div>
  );
}
