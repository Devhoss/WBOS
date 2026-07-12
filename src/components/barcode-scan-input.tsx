"use client";

import { CheckCircle2, ScanBarcode, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ScanFeedback = "success" | "error" | "duplicate" | null;

type BarcodeScanInputProps = {
  onScan: (barcode: string) => Promise<{ ok: boolean; message?: string }>;
  scannedIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  /** Time in ms to wait after last keystroke before treating as a complete scan (for wedge scanners) */
  scanTimeout?: number;
};

export function BarcodeScanInput({
  onScan,
  scannedIds = [],
  placeholder = "Scan barcode...",
  autoFocus = false,
  scanTimeout = 80,
}: BarcodeScanInputProps) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [scanning, setScanning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
    setFeedbackText("");
  }, []);

  const handleScan = useCallback(
    async (barcode: string) => {
      const val = barcode.trim();
      if (!val) return;

      if (scannedIds.includes(val)) {
        setFeedback("duplicate");
        setFeedbackText(`Already scanned: ${val}`);
        setTimeout(clearFeedback, 2000);
        return;
      }

      setScanning(true);
      try {
        const result = await onScan(val);
        if (result.ok) {
          setFeedback("success");
          setFeedbackText(`Scanned: ${val}`);
        } else {
          setFeedback("error");
          setFeedbackText(result.message ?? `Unknown: ${val}`);
        }
      } catch {
        setFeedback("error");
        setFeedbackText("Scan failed");
      } finally {
        setScanning(false);
        setTimeout(clearFeedback, 2000);
      }
    },
    [onScan, scannedIds, clearFeedback],
  );

  const handleChange = useCallback(
    (value: string) => {
      setInput(value);

      if (timerRef.current) clearTimeout(timerRef.current);

      if (value.length > 0) {
        timerRef.current = setTimeout(() => {
          handleScan(value).then(() => setInput(""));
        }, scanTimeout);
      }
    },
    [handleScan, scanTimeout],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        handleScan(input).then(() => setInput(""));
      }
    },
    [handleScan, input],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const feedbackIcon = feedback === "success" ? (
    <CheckCircle2 className="size-4 text-emerald-600" />
  ) : feedback === "error" || feedback === "duplicate" ? (
    <XCircle className="size-4 text-red-500" />
  ) : null;

  const borderColor =
    feedback === "success"
      ? "border-emerald-500"
      : feedback === "error" || feedback === "duplicate"
        ? "border-red-400"
        : "border-input";

  return (
    <div className="flex items-center gap-1.5">
      <div className={`relative flex items-center rounded-md border ${borderColor} bg-background transition-colors`}>
        <ScanBarcode className="ml-2 size-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          className="h-8 w-28 rounded-md bg-transparent px-1.5 text-[11px] outline-none"
          placeholder={placeholder}
          value={input}
          autoFocus={autoFocus}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {feedback ? (
        <span className={`inline-flex items-center gap-1 text-[10px] ${feedback === "success" ? "text-emerald-600" : "text-red-500"}`}>
          {feedbackIcon}
          {feedbackText}
        </span>
      ) : scanning ? (
        <span className="text-[10px] text-muted-foreground">Verifying...</span>
      ) : null}
    </div>
  );
}
