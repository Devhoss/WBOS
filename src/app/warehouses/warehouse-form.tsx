"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createWarehouse } from "@/domains/warehouses/actions/create-warehouse";
import { updateWarehouse } from "@/domains/warehouses/actions/update-warehouse";

export type WarehouseFormValue = {
  id: string; name: string; code: string; address: string; isDefault: boolean;
};

export function WarehouseForm({ onSuccess, warehouse }: {
  onSuccess?: () => void; warehouse?: WarehouseFormValue;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(warehouse);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const payload = {
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").toUpperCase(),
        address: String(formData.get("address") ?? ""),
        isDefault: formData.get("isDefault") === "on",
      };

      const result = warehouse
        ? await updateWarehouse({ id: warehouse.id, ...payload })
        : await createWarehouse(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} warehouse.`);
        return;
      }

      setMessage(isEditing ? "Warehouse updated." : "Warehouse created.");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Warehouse" : "Create Warehouse"}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={warehouse?.name} name="name" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Code</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary" defaultValue={warehouse?.code} name="code" required />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Address</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={warehouse?.address} name="address" />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input className="size-4" defaultChecked={warehouse?.isDefault} name="isDefault" type="checkbox" />
        <span>Use as default warehouse</span>
      </label>
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
