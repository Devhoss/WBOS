"use client";

import { Trash2, Upload, Eye, AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { uploadSignedInvoiceAction, removeSignedInvoiceAction } from "@/domains/sales/actions/upload-signed-invoice";

export function SignedInvoiceUpload({ soId, signedInvoicePath }: { soId: string; signedInvoicePath: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    const formData = new FormData();
    formData.set("salesOrderId", soId);
    formData.set("file", file);
    const result = await uploadSignedInvoiceAction(formData);
    setBusy(false);

    if (result.ok) {
      router.refresh();
    }
  }

  async function handleRemove() {
    setBusy(true);
    setConfirmRemove(false);
    await removeSignedInvoiceAction(soId);
    setBusy(false);
    router.refresh();
  }

  function triggerUpload() {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Proof of Delivery</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload the customer-signed delivery invoice as proof of delivery.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFile}
      />

      {signedInvoicePath ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-md border p-3 text-sm">
            <a
              href={signedInvoicePath}
              target="_blank"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <Eye className="size-4" />
              View Signed Invoice
            </a>
          </div>
          <div className="flex gap-2">
            <button
              onClick={triggerUpload}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
            >
              <Upload className="size-3.5" />
              {busy ? "Uploading..." : "Replace"}
            </button>
            {confirmRemove ? (
              <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-2">
                <AlertTriangle className="size-4 shrink-0 text-red-600" />
                <span className="text-xs text-red-700">Remove signed Proof of Delivery? This cannot be undone.</span>
                <button
                  onClick={handleRemove}
                  disabled={busy}
                  className="ml-auto inline-flex h-7 items-center rounded bg-red-600 px-2.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? "Removing..." : "Remove"}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-red-100"
                >
                  <X className="size-3.5 text-red-600" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 px-3 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            onClick={triggerUpload}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
          >
            <Upload className="size-4" />
            {busy ? "Uploading..." : "Upload Signed Invoice"}
          </button>
        </div>
      )}
    </section>
  );
}
