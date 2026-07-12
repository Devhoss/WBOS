import { t } from "@/components/document-engine";
import type { SectionProps } from "./types";

export function InvoiceHeader({ branding, invoice, language, isRtl }: SectionProps) {
  return (
    <table className="w-full" dir="ltr">
      <tbody>
        <tr>
          <td className="w-1/3 align-top">
            {branding.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- must use plain <img> for reliable Playwright PDF rendering
              <img
                src={`/${branding.logoPath}`}
                alt={branding.businessName}
                style={{ maxHeight: "100px", maxWidth: "240px", objectFit: "contain" }}
              />
            ) : (
              <div className="pt-1 text-lg font-bold tracking-tight text-gray-900">
                {branding.businessName}
              </div>
            )}
          </td>
          <td className={`w-2/3 align-top ${isRtl ? "text-left" : "text-right"}`}>
            <div className={`text-2xl font-bold tracking-tight text-gray-900 ${isRtl ? "text-left" : "text-right"}`}>
              {t("invoice", language)}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-600">
              {`#${invoice.invoiceNumber}`}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
