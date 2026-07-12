"use client";

import { useDocument } from "./document-context";

export type DocTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: Record<string, unknown>) => string | React.ReactNode;
};

export type DocTableProps = {
  columns: DocTableColumn[];
  data: Record<string, unknown>[];
};

export function DocumentTable({ columns, data }: DocTableProps) {
  const { language } = useDocument();
  const isRtl = language === "arabic";

  return (
    <div className="document-table">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-gray-800 bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-2 font-semibold uppercase tracking-wider text-gray-700 ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                }`}
                style={col.width ? { width: col.width } : undefined}
                dir={isRtl ? "rtl" : "ltr"}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={`border-b border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-2 text-gray-900 ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                  dir={isRtl && col.align !== "right" ? "rtl" : "ltr"}
                >
                  {typeof col.render === "function" ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
