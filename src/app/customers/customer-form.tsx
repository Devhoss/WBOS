"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createCustomer } from "@/domains/customers/actions/create-customer";
import { updateCustomer } from "@/domains/customers/actions/update-customer";

export type CustomerFormValue = {
  id: string;
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  creditLimit: string;
  notes: string;
};

export function CustomerForm({ onSuccess, customer }: {
  onSuccess?: () => void;
  customer?: CustomerFormValue;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(customer);

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
        creditLimit: String(formData.get("creditLimit") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      };

      const result = customer
        ? await updateCustomer({ id: customer.id, ...payload })
        : await createCustomer(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} customer.`);
        return;
      }

      setMessage(isEditing ? "Customer updated." : "Customer created.");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Customer" : "Create Customer"}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.name} name="name" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Code</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary" defaultValue={customer?.code} name="code" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Contact name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.contactName} name="contactName" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Email</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.email} name="email" type="email" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Phone</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.phone} name="phone" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Payment terms</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.paymentTerms} name="paymentTerms" placeholder="Net 30" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Credit limit</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.creditLimit} min="0" name="creditLimit" step="0.001" type="number" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Address</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.address} name="address" />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={customer?.notes} name="notes" />
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
