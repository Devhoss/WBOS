"use client";

import { useDocument } from "./document-context";

type TotalRow = {
  label: string;
  value: string;
  bold?: boolean;
  border?: boolean;
};

type DocumentTotalsProps = {
  rows: TotalRow[];
};

export function DocumentTotals({ rows }: DocumentTotalsProps) {
  const { language } = useDocument();
  const isRtl = language === "arabic";

  return (
    <div className="document-totals" dir={isRtl ? "rtl" : "ltr"}>
      <table className="ml-auto w-72 text-xs">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className={`py-1 pr-4 text-right ${row.bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                {row.label}
              </td>
              <td className={`py-1 text-right font-mono ${row.bold ? "text-base font-bold text-gray-900" : "text-gray-800"}`}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
