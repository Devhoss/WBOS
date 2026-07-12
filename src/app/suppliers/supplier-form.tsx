"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createSupplier } from "@/domains/suppliers/actions/create-supplier";
import { updateSupplier } from "@/domains/suppliers/actions/update-supplier";

export type SupplierFormValue = {
  id: string;
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  leadTimeDays: string;
  notes: string;
};

export function SupplierForm({ onSuccess, supplier }: {
  onSuccess?: () => void;
  supplier?: SupplierFormValue;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(supplier);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const payload = {
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").toUpperCase(),
        contactName: String(formData.get("contactName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
        paymentTerms: String(formData.get("paymentTerms") ?? ""),
        leadTimeDays: String(formData.get("leadTimeDays") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      };

      const result = supplier
        ? await updateSupplier({ id: supplier.id, ...payload })
        : await createSupplier(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} supplier.`);
        return;
      }

      setMessage(isEditing ? "Supplier updated." : "Supplier created.");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Supplier" : "Create Supplier"}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.name} name="name" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Code</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary" defaultValue={supplier?.code} name="code" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Contact name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.contactName} name="contactName" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Email</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.email} name="email" type="email" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Phone</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.phone} name="phone" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Payment terms</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.paymentTerms} name="paymentTerms" placeholder="Net 30" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Lead time days</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.leadTimeDays} min="0" name="leadTimeDays" type="number" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Address</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.address} name="address" />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={supplier?.notes} name="notes" />
        </label>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <Plus className="size-4" />
          {isPending ? (isEditing ? "Saving" : "Creating") : isEditing ? "Save Changes" : "Create"}
        </button>
        {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      </div>
    </form>
  );
}
