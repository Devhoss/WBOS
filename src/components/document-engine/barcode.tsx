"use client";

import { useEffect, useRef } from "react";

import JsBarcode from "jsbarcode";

export function Barcode({ value, height = 30, width = 1 }: { value: string; height?: number; width?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width,
        height,
        displayValue: false,
        margin: 0,
        background: "transparent",
      });
    }
  }, [value, height, width]);

  return <svg ref={ref} className="inline-block" />;
}

export { JsBarcode };
