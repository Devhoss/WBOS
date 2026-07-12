"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  function handlePrint() {
    const style = document.createElement("style");
    style.id = "print-style-override";
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        main, main * { visibility: visible; }
        main { position: absolute; left: 0; top: 0; width: 100%; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  }

  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
      onClick={handlePrint}
      type="button"
    >
      <Printer className="size-4" />
      Print
    </button>
  );
}
