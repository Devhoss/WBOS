"use client";

import { useEffect } from "react";

export function PrintAutoTrigger() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
