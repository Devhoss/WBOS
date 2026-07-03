"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { createWarehouse } from "@/domains/warehouses/actions/create-warehouse";

export function WarehouseForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const result = await createWarehouse({
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").toUpperCase(),
        address: String(formData.get("address") ?? ""),
        isDefault: formData.get("isDefault") === "on",
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to create warehouse.");
        return;
      }

      setMessage("Warehouse created.");
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">Create Warehouse</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="name" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Code</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary" name="code" required />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Address</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="address" />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input className="size-4" name="isDefault" type="checkbox" />
        <span>Use as default warehouse</span>
      </label>
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
