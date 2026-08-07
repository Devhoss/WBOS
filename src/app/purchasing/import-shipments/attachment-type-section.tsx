"use client";

import type { AttachmentType } from "@prisma/client";
import { FileText, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteAttachmentAction } from "@/domains/attachments/actions/delete-attachment";
import { uploadAttachmentAction } from "@/domains/attachments/actions/upload-attachment";

import { REQUIRED_ATTACHMENT_TYPES } from "@/domains/import-shipments/stage/compute-shipment-state";
import { HelpTooltip } from "@/components/help-tooltip";
import type { WholesaleTermKey } from "@/lib/wholesale-terms";

type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  uploadedByName: string | null;
  createdAt: string;
  attachmentType: AttachmentType;
};

const TYPE_OPTIONS: { value: AttachmentType; label: string }[] = [
  { value: "PROFORMA", label: "Proforma Invoice" },
  { value: "COMMERCIAL_INVOICE", label: "Commercial Invoice" },
  { value: "PACKING_LIST", label: "Packing List" },
  { value: "BILL_OF_LADING", label: "Bill of Lading" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "PAYMENT_RECEIPT", label: "Payment Receipt" },
  { value: "OTHER", label: "Other" },
];

const TYPE_TERM: Partial<Record<AttachmentType, WholesaleTermKey>> = {
  PROFORMA: "proformaInvoice",
  COMMERCIAL_INVOICE: "commercialInvoice",
  PACKING_LIST: "packingList",
  BILL_OF_LADING: "billOfLading",
};

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

export function AttachmentTypeSection({
  entityType,
  entityId,
  attachments,
}: {
  entityType: string;
  entityId: string;
  attachments: AttachmentRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleUpload(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      const selectedType = formData.get("attachmentType") as string | null;
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      if (selectedType) formData.append("attachmentType", selectedType);
      const result = await uploadAttachmentAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Unable to upload file.");
        setIsPending(false);
        return;
      }
      router.refresh();
    } catch { setError("An unexpected error occurred."); }
    setIsPending(false);
  }

  async function handleDelete(attachmentId: string) {
    setError(null);
    setIsPending(true);
    try {
      const result = await deleteAttachmentAction(attachmentId, entityId);
      if (!result.ok) {
        setError(result.message ?? "Unable to remove attachment.");
        setIsPending(false);
        setConfirmDelete(null);
        return;
      }
      router.refresh();
    } catch { setError("An unexpected error occurred."); }
    setIsPending(false);
    setConfirmDelete(null);
  }

  const grouped = TYPE_OPTIONS.map((opt) => ({
    ...opt,
    term: TYPE_TERM[opt.value],
    rows: attachments.filter((a) => a.attachmentType === opt.value),
  }));
  const requiredMet = REQUIRED_ATTACHMENT_TYPES.every((t) =>
    attachments.some((a) => a.attachmentType === t),
  );

  return (
    <section className="rounded-lg border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Shipment Documents</h2>
        <span className={`text-xs font-medium ${requiredMet ? "text-emerald-600" : "text-amber-600"}`}>
          {requiredMet ? "All required documents attached" : "Missing required documents"}
        </span>
      </div>

      <form action={handleUpload} className="mt-3 flex flex-wrap items-center gap-3">
        <select name="attachmentType" className="h-9 rounded-md border bg-background px-2 text-sm" defaultValue="PROFORMA">
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-muted file:px-3 file:py-1.5 file:text-sm" name="file" type="file" required />
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60" disabled={isPending} type="submit">
          <Upload className="size-4" />Upload
        </button>
        {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
      </form>

      <div className="mt-4 space-y-4">
        {grouped.map((group) => (
          <div key={group.value}>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
              {REQUIRED_ATTACHMENT_TYPES.includes(group.value)
                ? " · required"
                : " · optional"}
              {group.term ? <HelpTooltip term={group.term} /> : null}
            </p>
            {group.rows.length > 0 ? (
              <ul className="space-y-1.5">
                {group.rows.map((att) => (
                  <li key={att.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      {att.url ? (
                        <a href={att.url} target="_blank" rel="noreferrer" className="truncate font-medium text-primary hover:underline">
                          {att.fileName}
                        </a>
                      ) : (
                        <span className="truncate font-medium">{att.fileName}</span>
                      )}
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(att.sizeBytes / 1024).toFixed(0)} KB{att.uploadedByName ? ` · ${att.uploadedByName}` : ""}
                      </span>
                    </div>
                    <button className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" disabled={isPending} type="button" onClick={() => setConfirmDelete(att.id)}>
                      <Trash2 className="size-3.5" />Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{TYPE_LABEL[group.value]} not attached.</p>
            )}
          </div>
        ))}
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents yet.</p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Remove attachment"
        description="Remove this attachment?"
        confirmLabel="Remove"
        busy={isPending}
        onConfirm={() => { if (confirmDelete) void handleDelete(confirmDelete); }}
      />
    </section>
  );
}