"use client";

import { useDocument } from "./document-context";

type DocMetaField = {
  label: string;
  value: string;
};

type DocumentMetadataProps = {
  fields: DocMetaField[];
  rightFields?: DocMetaField[];
};

export function DocumentMetadata({ fields, rightFields }: DocumentMetadataProps) {
  const { language } = useDocument();
  const isRtl = language === "arabic";
  const align = isRtl ? "text-right" : "text-left";

  return (
    <div className="document-metadata">
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className={`w-1/2 align-top ${align}`} dir={isRtl ? "rtl" : "ltr"}>
              <table className="w-full">
                <tbody>
                  {fields.map((f, i) => (
                    <tr key={i}>
                      <td className="py-0.5 pr-2 text-gray-500">{f.label}</td>
                      <td className={`py-0.5 font-medium text-gray-900 ${align}`}>{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
            {rightFields ? (
              <td className={`w-1/2 align-top ${align}`} dir={isRtl ? "rtl" : "ltr"}>
                <table className="w-full">
                  <tbody>
                    {rightFields.map((f, i) => (
                      <tr key={i}>
                        <td className="py-0.5 pr-2 text-gray-500">{f.label}</td>
                        <td className={`py-0.5 font-medium text-gray-900 ${align}`}>{f.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
