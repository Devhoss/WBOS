"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { deleteAttachmentAction } from "@/domains/attachments/actions/delete-attachment";
import { uploadAttachmentAction } from "@/domains/attachments/actions/upload-attachment";

export type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  uploadedByName: string | null;
  createdAt: string;
};

export function AttachmentSection({
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

  async function handleUpload(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
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
    if (!window.confirm("Remove this attachment?")) return;
    setError(null);
    setIsPending(true);
    try {
      const result = await deleteAttachmentAction(attachmentId, entityId);
      if (!result.ok) {
        setError(result.message ?? "Unable to remove attachment.");
        setIsPending(false);
        return;
      }
      router.refresh();
    } catch { setError("An unexpected error occurred."); }
    setIsPending(false);
  }

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Attachments</h2>
      <form action={handleUpload} className="mt-3 flex flex-wrap items-center gap-3">
        <input className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-muted file:px-3 file:py-1.5 file:text-sm" name="file" type="file" required />
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60" disabled={isPending} type="submit">
          <Upload className="size-4" />Upload
        </button>
        {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
      </form>

      {attachments.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {attachments.map((att) => (
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
              <button className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" disabled={isPending} type="button" onClick={() => handleDelete(att.id)}>
                <Trash2 className="size-3.5" />Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No attachments yet.</p>
      )}
    </section>
  );
}