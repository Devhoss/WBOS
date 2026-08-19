"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ExternalLink,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  describePodFileRejection,
  type ProofOfDeliveryDocument,
  type ProofOfDeliveryView,
} from "@/domains/sales/proof-of-delivery";

/**
 * Proof of delivery, shown on the sales order.
 *
 * The documents belong to a delivery, so the set is grouped by shipment even
 * when there is only one — an order that ships twice has two signatures, and
 * flattening them onto the order would lose which one covers which drop.
 *
 * Uploads go one file per request to the same `/api/v1` route the phone uses.
 * A batch endpoint would be less code here and wrong: when one page of five
 * fails, only that page should be re-sent.
 */

type PendingStatus = "queued" | "uploading" | "done" | "failed" | "duplicate";

type PendingUpload = {
  /** Stable across retries, so a retry replaces its row rather than adding one. */
  key: string;
  file: File;
  previewUrl: string;
  status: PendingStatus;
  progress: number;
  error: string | null;
};

let pendingSeq = 0;

/**
 * One file, with progress. `fetch` cannot report upload progress, so this is
 * XHR — the same reason the phone uses axios's `onUploadProgress`.
 */
function uploadOne(
  shipmentId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<{ duplicate: boolean }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/deliveries/${shipmentId}/proof-of-delivery`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("Network error. The document was not uploaded."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.onload = () => {
      let body: { error?: string; duplicate?: boolean } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Falls through to the status-based message below.
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve({ duplicate: Boolean(body.duplicate) });
        return;
      }
      reject(new Error(body.error ?? `Upload failed (${xhr.status}).`));
    };
    xhr.send(form);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentTile({
  document,
  disabled,
  onMove,
  onRemove,
}: {
  document: ProofOfDeliveryDocument;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isImage = document.mimeType.startsWith("image/");

  return (
    <li className="flex items-center gap-3 rounded-md border p-2">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={disabled}
          aria-label={`Move page ${document.pageNumber} earlier`}
          className="rounded p-0.5 transition hover:bg-muted disabled:opacity-40"
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={disabled}
          aria-label={`Move page ${document.pageNumber} later`}
          className="rounded p-0.5 transition hover:bg-muted disabled:opacity-40"
        >
          <ArrowDown className="size-3.5" />
        </button>
      </div>

      <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
        {document.pageNumber}
      </span>

      <a
        href={document.url}
        target="_blank"
        rel="noreferrer"
        className="size-12 shrink-0 overflow-hidden rounded border bg-muted"
      >
        {isImage ? (
          // The authenticated uploads route, not a public path. Plain <img>
          // rather than next/image: next/image would proxy a tenant-private
          // document through the image optimiser's cache.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={document.url}
            alt={`Proof of delivery page ${document.pageNumber}`}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            PDF
          </span>
        )}
      </a>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{document.fileName}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatBytes(document.sizeBytes)}
          {document.uploadedBy?.name ? ` · ${document.uploadedBy.name}` : ""}
        </p>
      </div>

      <a
        href={document.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex size-7 items-center justify-center rounded transition hover:bg-muted"
        aria-label={`Open page ${document.pageNumber}`}
      >
        <ExternalLink className="size-3.5" />
      </a>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove page ${document.pageNumber}`}
        className="inline-flex size-7 items-center justify-center rounded text-red-600 transition hover:bg-red-50 disabled:opacity-40"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

function DeliveryPanel({
  shipmentId,
  shipmentNumber,
  status,
  documents,
  onChanged,
}: {
  shipmentId: string;
  shipmentNumber: string;
  status: string;
  documents: ProofOfDeliveryDocument[];
  onChanged: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const update = useCallback((key: string, patch: Partial<PendingUpload>) => {
    setPending((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }, []);

  const runUpload = useCallback(
    async (row: PendingUpload) => {
      update(row.key, { status: "uploading", progress: 0, error: null });
      try {
        const { duplicate } = await uploadOne(shipmentId, row.file, (fraction) =>
          update(row.key, { progress: fraction }),
        );
        update(row.key, { status: duplicate ? "duplicate" : "done", progress: 1 });
        return true;
      } catch (err) {
        // Left in the list, not discarded. A failed upload that vanishes is
        // indistinguishable from one that succeeded.
        update(row.key, {
          status: "failed",
          error: err instanceof Error ? err.message : "Upload failed.",
        });
        return false;
      }
    },
    [shipmentId, update],
  );

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (chosen.length === 0) return;

    setError(null);

    const accepted: PendingUpload[] = [];
    const rejected: string[] = [];
    for (const file of chosen) {
      const rejection = describePodFileRejection(file.type, file.size);
      if (rejection) {
        rejected.push(`${file.name}: ${rejection}`);
        continue;
      }
      accepted.push({
        key: `p${pendingSeq++}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
        error: null,
      });
    }

    if (rejected.length > 0) setError(rejected.join(" "));
    if (accepted.length === 0) return;

    setPending((rows) => [...rows, ...accepted]);
    setBusy(true);
    // Sequential so page order follows the order they were chosen in.
    for (const row of accepted) {
      await runUpload(row);
    }
    setBusy(false);
    await onChanged();
  }

  async function retryFailed() {
    const failed = pending.filter((row) => row.status === "failed");
    if (failed.length === 0) return;
    setBusy(true);
    for (const row of failed) {
      await runUpload(row);
    }
    setBusy(false);
    await onChanged();
  }

  function dismissSettled() {
    setPending((rows) => {
      for (const row of rows) {
        if (row.status !== "failed") URL.revokeObjectURL(row.previewUrl);
      }
      return rows.filter((row) => row.status === "failed");
    });
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= documents.length) return;
    const ids = documents.map((d) => d.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/deliveries/${shipmentId}/proof-of-delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: ids }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save the new page order.");
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the new page order.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(documentId: string) {
    setBusy(true);
    setConfirmRemove(null);
    setError(null);
    try {
      const response = await fetch(`/api/v1/proof-of-delivery/${documentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not remove this document.");
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this document.");
    } finally {
      setBusy(false);
    }
  }

  const settled = pending.filter((row) => row.status !== "failed" && row.status !== "queued");
  const failedCount = pending.filter((row) => row.status === "failed").length;
  const overall =
    pending.length === 0
      ? 0
      : pending.reduce((sum, row) => sum + (row.status === "queued" ? 0 : row.progress), 0) /
        pending.length;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">{shipmentNumber}</p>
          <p className="text-[11px] text-muted-foreground">
            {documents.length === 0
              ? "No proof of delivery yet"
              : `${documents.length} document${documents.length === 1 ? "" : "s"}`}
            {" · "}
            {status.toLowerCase().replace(/_/g, " ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
        >
          <Upload className="size-3.5" />
          Add documents
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        className="hidden"
        onChange={handleFiles}
      />

      {documents.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {documents.map((document, index) => (
            <DocumentTile
              key={document.id}
              document={document}
              disabled={busy}
              onMove={(direction) => move(index, direction)}
              onRemove={() => setConfirmRemove(document.id)}
            />
          ))}
        </ul>
      ) : null}

      {confirmRemove ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-2">
          <AlertTriangle className="size-4 shrink-0 text-red-600" />
          <span className="text-xs text-red-700">
            Remove this proof-of-delivery document? This cannot be undone.
          </span>
          <button
            onClick={() => remove(confirmRemove)}
            disabled={busy}
            className="ml-auto inline-flex h-7 items-center rounded bg-red-600 px-2.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            Remove
          </button>
          <button
            onClick={() => setConfirmRemove(null)}
            aria-label="Cancel removal"
            className="inline-flex size-7 items-center justify-center rounded hover:bg-red-100"
          >
            <X className="size-3.5 text-red-600" />
          </button>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mt-3 rounded-md border bg-muted/30 p-2">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span>
              Uploading {pending.filter((r) => r.status === "done" || r.status === "duplicate").length}
              /{pending.length}
            </span>
            <span>{Math.round(overall * 100)}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(overall * 100)}%` }}
            />
          </div>

          <ul className="mt-2 space-y-1">
            {pending.map((row) => (
              <li key={row.key} className="flex items-center gap-2 text-[11px]">
                {row.status === "uploading" ? (
                  <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
                ) : row.status === "failed" ? (
                  <AlertTriangle className="size-3 shrink-0 text-red-600" />
                ) : row.status === "queued" ? (
                  <Camera className="size-3 shrink-0 text-muted-foreground" />
                ) : (
                  <Check className="size-3 shrink-0 text-green-600" />
                )}
                <span className="min-w-0 flex-1 truncate">{row.file.name}</span>
                <span
                  className={
                    row.status === "failed" ? "shrink-0 text-red-600" : "shrink-0 text-muted-foreground"
                  }
                >
                  {row.status === "failed"
                    ? (row.error ?? "Failed")
                    : row.status === "duplicate"
                      ? "Already uploaded"
                      : row.status === "done"
                        ? "Uploaded"
                        : `${Math.round(row.progress * 100)}%`}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex gap-2">
            {failedCount > 0 ? (
              <button
                type="button"
                onClick={retryFailed}
                disabled={busy}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition hover:bg-muted disabled:opacity-60"
              >
                <RotateCcw className="size-3" />
                Retry {failedCount} failed
              </button>
            ) : null}
            {settled.length > 0 && !busy ? (
              <button
                type="button"
                onClick={dismissSettled}
                className="inline-flex h-7 items-center rounded-md px-2.5 text-[11px] text-muted-foreground transition hover:bg-muted"
              >
                Clear finished
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ProofOfDeliverySection({ initial }: { initial: ProofOfDeliveryView }) {
  const [view, setView] = useState(initial);

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/v1/sales/orders/${initial.salesOrderId}/proof-of-delivery`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const body = await response.json();
    setView(body.data as ProofOfDeliveryView);
  }, [initial.salesOrderId]);

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Proof of Delivery</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The customer-signed delivery paperwork, photographed page by page. Each page is stored
        separately and requires a signed-in session to view.
      </p>

      {view.deliveries.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          This order has no delivery yet. Proof of delivery can be attached once a shipment exists.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {view.deliveries.map((delivery) => (
            <DeliveryPanel
              key={delivery.shipmentId}
              shipmentId={delivery.shipmentId}
              shipmentNumber={delivery.shipmentNumber}
              status={delivery.status}
              documents={delivery.documents}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {view.legacySignedInvoicePath ? (
        <div className="mt-3 rounded-md border border-dashed p-3">
          <p className="text-[11px] font-medium text-muted-foreground">
            Earlier signed invoice
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Uploaded before proof of delivery supported multiple pages. Still available; new pages
            go to the delivery above.
          </p>
          <a
            href={view.legacySignedInvoicePath}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            View earlier signed invoice
          </a>
        </div>
      ) : null}
    </section>
  );
}
