"use client";

import { useEffect, useRef } from "react";

import QRCode from "qrcode";

export function QR({ value, size = 64 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) {
      QRCode.toCanvas(ref.current, value, {
        width: size,
        margin: 1,
        color: { dark: "#1a1a1a", light: "#ffffff" },
      });
    }
  }, [value, size]);

  return <canvas ref={ref} className="inline-block" width={size} height={size} />;
}
