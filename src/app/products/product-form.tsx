"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { createProduct } from "@/domains/products/actions/create-product";
import { updateProduct } from "@/domains/products/actions/update-product";

type Option = {
  id: string;
  name: string;
  code?: string | null;
};

export type ProductFormValue = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  supplierId: string | null;
  unitOfMeasureId: string;
  status: "DRAFT" | "ACTIVE" | "DISCONTINUED" | "ARCHIVED";
  defaultSellingPrice: string | null;
  defaultCurrency: "KWD" | "USD" | "EUR";
};

export function ProductForm({
  categories,
  onSuccess,
  product,
  suppliers,
  units,
}: {
  categories: Option[];
  onSuccess?: () => void;
  product?: ProductFormValue;
  suppliers: Option[];
  units: Option[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(product);

  const requiredMark = <span className="text-destructive">*</span>;

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const payload = {
        sku: String(formData.get("sku") ?? "").toUpperCase(),
        barcode: String(formData.get("barcode") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
        supplierId: String(formData.get("supplierId") ?? ""),
        unitOfMeasureId: String(formData.get("unitOfMeasureId") ?? ""),
        status: String(formData.get("status") ?? "DRAFT"),
        defaultSellingPrice: String(formData.get("defaultSellingPrice") ?? ""),
        defaultCurrency: String(formData.get("defaultCurrency") ?? "KWD"),
      };
      const result = product ? await updateProduct({ id: product.id, ...payload }) : await createProduct(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} product.`);
        return;
      }

      setMessage(isEditing ? "Product updated." : "Product created.");
      onSuccess?.();
    });
  }

  return (
    <form action={handleSubmit} className="scroll-mt-24 rounded-lg border p-5" id="product-create-form">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Product" : "Create Product"}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">SKU {requiredMark}</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary"
            defaultValue={product?.sku}
            name="sku"
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Barcode</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            defaultValue={product?.barcode ?? ""}
            name="barcode"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name {requiredMark}</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            defaultValue={product?.name}
            name="name"
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Category {requiredMark}</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            defaultValue={product?.categoryId ?? ""}
            name="categoryId"
            required
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Supplier</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            defaultValue={product?.supplierId ?? ""}
            name="supplierId"
          >
            <option value="">None</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Unit {requiredMark}</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            defaultValue={product?.unitOfMeasureId ?? ""}
            name="unitOfMeasureId"
            required
          >
            <option value="">Select unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.code})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Status</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            defaultValue={product?.status ?? "DRAFT"}
            name="status"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="DISCONTINUED">Discontinued</option>
            {isEditing ? <option value="ARCHIVED">Archived</option> : null}
          </select>
        </label>
        <div className="space-y-2 text-sm">
          <span className="font-medium">Default selling price</span>
          <div className="grid grid-cols-[1fr_92px] overflow-hidden rounded-md border focus-within:border-primary">
            <input
              className="h-10 min-w-0 border-0 bg-background px-3 text-sm outline-none"
              defaultValue={product?.defaultSellingPrice ?? ""}
              min="0"
              name="defaultSellingPrice"
              step="0.001"
              type="number"
            />
            <select
              className="h-10 border-l bg-background px-2 text-sm outline-none"
              defaultValue={product?.defaultCurrency ?? "KWD"}
              name="defaultCurrency"
            >
              <option value="KWD">KWD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <label className="space-y-2 text-sm xl:col-span-3">
          <span className="font-medium">Description</span>
          <textarea
            className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            defaultValue={product?.description ?? ""}
            name="description"
            rows={4}
          />
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
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
