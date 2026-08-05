"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createSupplierInvoice } from "@/domains/supplier-invoices/actions/create-supplier-invoice";
import { updateSupplierInvoice } from "@/domains/supplier-invoices/actions/update-supplier-invoice";

type SupplierOption = {
  id: string;
  name: string;
};

export type SupplierInvoiceFormValue = {
  id: string;
  supplierId: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  reference: string;
  dueDate: string;
  notes: string;
};

export function SupplierInvoiceForm({
  suppliers,
  invoice,
}: {
  suppliers: SupplierOption[];
  invoice?: SupplierInvoiceFormValue;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(invoice);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    const subtotal = Number(String(formData.get("subtotal") ?? "0"));
    const taxAmount = Number(String(formData.get("taxAmount") ?? "0"));
    const totalAmount = subtotal + taxAmount;

    startTransition(async () => {
      const payload = {
        supplierId: String(formData.get("supplierId") ?? ""),
        currency: String(formData.get("currency") ?? "KWD"),
        subtotal,
        taxAmount,
        totalAmount,
        reference: String(formData.get("reference") ?? "") || undefined,
        dueDate: String(formData.get("dueDate") ?? "") ? new Date(String(formData.get("dueDate"))) : undefined,
        notes: String(formData.get("notes") ?? "") || undefined,
      };

      const result = invoice
        ? await updateSupplierInvoice({ id: invoice.id, ...payload })
        : await createSupplierInvoice(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} supplier invoice.`);
        return;
      }

      const targetId = "id" in result && result.id ? result.id : invoice?.id;
      router.push(`/purchasing/supplier-invoices/${targetId}`);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Supplier Invoice" : "Create Supplier Invoice"}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Supplier *</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={invoice?.supplierId} name="supplierId" required>
            <option value="" disabled>Select a supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Currency</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={invoice?.currency ?? "KWD"} name="currency">
            <option value="KWD">KWD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Subtotal *</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" defaultValue={invoice?.subtotal} min="0" step="0.001" name="subtotal" required type="number" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Tax Amount</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" defaultValue={invoice?.taxAmount ?? "0"} min="0" step="0.001" name="taxAmount" type="number" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Reference</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={invoice?.reference} name="reference" placeholder="Supplier invoice number..." />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Due Date</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={invoice?.dueDate} name="dueDate" type="date" />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={invoice?.notes} name="notes" placeholder="Optional notes..." />
        </label>

        <div className="md:col-span-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
          Total: <strong className="font-mono">{(Number(invoice?.subtotal ?? 0) + Number(invoice?.taxAmount ?? 0)).toFixed(3)}</strong>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <Plus className="size-4" />
          {isPending ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Supplier Invoice"}
        </button>
        {message ? <p className="text-sm text-red-500" role="alert">{message}</p> : null}
      </div>
    </form>
  );
}