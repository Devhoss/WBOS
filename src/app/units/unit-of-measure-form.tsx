"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createUnitOfMeasure } from "@/domains/units/actions/create-unit-of-measure";
import { updateUnitOfMeasure } from "@/domains/units/actions/update-unit-of-measure";

export type UnitFormValue = {
  id: string; name: string; code: string; description: string;
  isBaseUnit: boolean; conversionToBase: string;
};

export function UnitOfMeasureForm({ onSuccess, unit }: {
  onSuccess?: () => void; unit?: UnitFormValue;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(unit);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const isBaseUnit = formData.get("isBaseUnit") === "on";
      const payload = {
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").toUpperCase(),
        description: String(formData.get("description") ?? ""),
        isBaseUnit,
        conversionToBase: isBaseUnit ? "1" : String(formData.get("conversionToBase") ?? ""),
      };

      const result = unit
        ? await updateUnitOfMeasure({ id: unit.id, ...payload })
        : await createUnitOfMeasure(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} unit.`);
        return;
      }

      setMessage(isEditing ? "Unit updated." : "Unit created.");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Unit" : "Create Unit"}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={unit?.name} name="name" placeholder="Piece" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Code</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary" defaultValue={unit?.code} name="code" placeholder="PCS" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Conversion to base</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={unit?.conversionToBase} min="0.000001" name="conversionToBase" step="0.000001" type="number" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Description</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={unit?.description} name="description" />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input className="size-4" defaultChecked={unit?.isBaseUnit} name="isBaseUnit" type="checkbox" />
        <span>Use as base unit</span>
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
