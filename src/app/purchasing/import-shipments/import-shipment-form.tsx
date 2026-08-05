"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createImportShipment } from "@/domains/import-shipments/actions/create-import-shipment";
import { updateImportShipment } from "@/domains/import-shipments/actions/update-import-shipment";

type SupplierOption = {
  id: string;
  name: string;
};

export type ImportShipmentFormValue = {
  id: string;
  supplierId: string;
  currency: string;
  containerRef: string;
  vessel: string;
  portOfLoading: string;
  portOfDischarge: string;
  etd: string;
  eta: string;
  notes: string;
};

export function ImportShipmentForm({
  suppliers,
  shipment,
}: {
  suppliers: SupplierOption[];
  shipment?: ImportShipmentFormValue;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(shipment);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const payload = {
        supplierId: String(formData.get("supplierId") ?? ""),
        currency: String(formData.get("currency") ?? "KWD"),
        containerRef: String(formData.get("containerRef") ?? "") || undefined,
        vessel: String(formData.get("vessel") ?? "") || undefined,
        portOfLoading: String(formData.get("portOfLoading") ?? "") || undefined,
        portOfDischarge: String(formData.get("portOfDischarge") ?? "") || undefined,
        etd: String(formData.get("etd") ?? "") ? new Date(String(formData.get("etd"))) : undefined,
        eta: String(formData.get("eta") ?? "") ? new Date(String(formData.get("eta"))) : undefined,
        notes: String(formData.get("notes") ?? "") || undefined,
      };

      const result = shipment
        ? await updateImportShipment({ id: shipment.id, ...payload })
        : await createImportShipment(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} import shipment.`);
        return;
      }

      const targetId = "id" in result && result.id ? result.id : shipment?.id;
      router.push(`/purchasing/import-shipments/${targetId}`);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Import Shipment" : "Create Import Shipment"}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Supplier *</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.supplierId} name="supplierId" required>
            <option value="" disabled>Select a supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Currency</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.currency ?? "KWD"} name="currency">
            <option value="KWD">KWD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Container Reference</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.containerRef} name="containerRef" placeholder="e.g. MSKU1234567" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Vessel</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.vessel} name="vessel" placeholder="Vessel / voyage" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Port of Loading</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.portOfLoading} name="portOfLoading" placeholder="e.g. Shanghai" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Port of Discharge</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.portOfDischarge} name="portOfDischarge" placeholder="e.g. Shuaiba" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">ETD</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.etd} name="etd" type="date" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">ETA</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.eta} name="eta" type="date" />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={shipment?.notes} name="notes" placeholder="Optional notes..." />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <Plus className="size-4" />
          {isPending ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Import Shipment"}
        </button>
        {message ? <p className="text-sm text-red-500" role="alert">{message}</p> : null}
      </div>
    </form>
  );
}