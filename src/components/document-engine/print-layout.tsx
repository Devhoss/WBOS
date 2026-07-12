"use client";

export function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="print-page" style={{
      width: "210mm",
      minHeight: "297mm",
      margin: "0 auto",
      padding: "12mm 15mm",
      background: "white",
      boxSizing: "border-box",
      fontFamily: "'Noto Sans Arabic', 'Noto Naskh Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      fontSize: "12px",
      lineHeight: 1.5,
      color: "#1a1a1a",
    }}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }

        .print-page {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .print-page table {
          page-break-inside: avoid;
        }

        .print-page .avoid-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .print-page .section-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      `}</style>
      {children}
    </div>
  );
}
