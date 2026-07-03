"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { createSupplier } from "@/domains/suppliers/actions/create-supplier";

export function SupplierForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const result = await createSupplier({
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").toUpperCase(),
        contactName: String(formData.get("contactName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
        paymentTerms: String(formData.get("paymentTerms") ?? ""),
        leadTimeDays: String(formData.get("leadTimeDays") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to create supplier.");
        return;
      }

      setMessage("Supplier created.");
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">Create Supplier</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="name" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Code</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary" name="code" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Contact name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="contactName" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Email</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="email" type="email" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Phone</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="phone" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Payment terms</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="paymentTerms" placeholder="Net 30" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Lead time days</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" min="0" name="leadTimeDays" type="number" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Address</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="address" />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="notes" />
        </label>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <Plus className="size-4" />
          {isPending ? "Creating" : "Create"}
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
