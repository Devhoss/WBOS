"use client";

import { Archive, Pencil } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { archiveImportShipment } from "@/domains/import-shipments/actions/update-import-shipment";

export function ImportShipmentActions({
  shipmentId,
  archivedAt,
}: {
  shipmentId: string;
  archivedAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  async function archiveDoc() {
    setFeedback(null);
    const result = await archiveImportShipment({ id: shipmentId });
    if (!result.ok) { setFeedback(result.message ?? null); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {feedback ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{feedback}</p> : null}
      <Link
        href={`/purchasing/import-shipments/${shipmentId}/edit`}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
      >
        <Pencil className="size-4" />Edit Details
      </Link>
      {!archivedAt ? (
        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60" disabled={isPending} type="button" onClick={() => startTransition(() => void archiveDoc())}>
          <Archive className="size-4" />{isPending ? "Archiving..." : "Archive Shipment"}
        </button>
      ) : null}
    </div>
  );
}