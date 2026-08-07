"use client";

import { Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { activateProduct } from "@/domains/products/actions/activate-product";
import { archiveProduct } from "@/domains/products/actions/archive-product";
import { deleteProduct } from "@/domains/products/actions/delete-product";

import { ProductForm, type ProductFormValue } from "./product-form";

type Option = {
  id: string;
  name: string;
  code?: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  arabicName: string | null;
  description: string | null;
  categoryId: string;
  category: string;
  supplierId: string | null;
  unitOfMeasureId: string;
  unit: string;
  status: "DRAFT" | "ACTIVE" | "DISCONTINUED" | "ARCHIVED";
  defaultSellingPrice: string | null;
  defaultCurrency: "KWD" | "USD" | "EUR";
  defaultPrice: string | null;
  supplier: string | null;
};

const statusStyles: Record<ProductRow["status"], string> = {
  DRAFT: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  ACTIVE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  DISCONTINUED:
    "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300",
  ARCHIVED: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300",
};

function focusProductForm() {
  const form = document.getElementById("product-create-form");
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    const input = form?.querySelector<HTMLInputElement>("input[name='sku']");
    input?.focus();
  }, 300);
}

function ProductStatusBadge({ status }: { status: ProductRow["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase leading-none ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

function ProductActions({
  categories,
  onFeedback,
  product,
  suppliers,
  units,
}: {
  categories: Option[];
  onFeedback: (message: string) => void;
  product: ProductRow;
  suppliers: Option[];
  units: Option[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function runAction(
    action: () => Promise<{ ok: boolean; message?: string }>,
    successMessage: string,
  ) {
    onFeedback("");
    const result = await action();
    onFeedback(
      result.ok
        ? successMessage
        : (result.message ?? "Unable to update product."),
    );
    if (result.ok) router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    await runAction(() => deleteProduct({ id: product.id }), "Product deleted.");
    setDeleting(false);
    setConfirmDelete(false);
  }

  useEffect(() => {
    if (!isEditing) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsEditing(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEditing]);

  const items = [
    { label: "Edit", onClick: () => setIsEditing(true) },
    ...(product.status === "ACTIVE"
      ? [
          {
            label: "Archive",
            onClick: () =>
              void runAction(
                () => archiveProduct({ id: product.id }),
                "Product archived.",
              ),
          },
        ]
      : product.status === "ARCHIVED"
        ? [
            {
              label: "Activate",
              onClick: () =>
                void runAction(
                  () => activateProduct({ id: product.id }),
                  "Product activated.",
                ),
            },
          ]
        : []),
    {
      label: "Delete",
      variant: "destructive" as const,
      onClick: () => setConfirmDelete(true),
    },
  ];

  return (
    <>
      <ActionMenu items={items} />
      {isEditing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Edit Product</h2>
              <button
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                type="button"
                onClick={() => setIsEditing(false)}
              >
                Close
              </button>
            </div>
            <div className="p-5">
              <ProductForm
                categories={categories}
                product={toFormValue(product)}
                suppliers={suppliers}
                units={units}
                onSuccess={() => setIsEditing(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete product"
        description={`Delete ${product.name}? This cannot be undone if the product has no related records.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

function toFormValue(product: ProductRow): ProductFormValue {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    arabicName: product.arabicName,
    description: product.description,
    categoryId: product.categoryId,
    supplierId: product.supplierId,
    unitOfMeasureId: product.unitOfMeasureId,
    status: product.status,
    defaultSellingPrice: product.defaultSellingPrice,
    defaultCurrency: product.defaultCurrency,
  };
}

export function ProductTable({
  categories,
  products,
  suppliers,
  units,
}: {
  categories: Option[];
  products: ProductRow[];
  suppliers: Option[];
  units: Option[];
}) {
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.arabicName ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  if (products.length === 0 && !search) {
    return (
      <section className="rounded-lg border px-6 py-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Package className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No products yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Create your first catalog item to start building your inventory
          catalog.
        </p>
        <button
          className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          type="button"
          onClick={focusProductForm}
        >
          Create Product
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border">
      {feedback ? (
        <div
          className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {feedback}
        </div>
      ) : null}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search SKU, barcode, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filteredProducts.length} of {products.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
          <thead className="text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-left">
                SKU
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-left">
                Name
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-left">
                Arabic Name
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-left">
                Category
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-left">
                Unit
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-center">
                Status
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-right">
                Default Price
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-left">
                Supplier
              </th>
              <th className="sticky top-0 z-10 h-11 border-b border-border bg-background px-4 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr
                key={product.id}
                className="h-14 transition odd:bg-muted/20 hover:bg-muted/50"
              >
                <td className="whitespace-nowrap border-b border-border px-4 font-medium">
                  {product.sku}
                </td>
                <td className="border-b border-border px-4 font-medium">
                  {product.name}
                </td>
                <td className="border-b border-border px-4 text-muted-foreground">
                  {product.arabicName ?? "—"}
                </td>
                <td className="border-b border-border px-4 text-muted-foreground">
                  {product.category}
                </td>
                <td className="whitespace-nowrap border-b border-border px-4 text-muted-foreground">
                  {product.unit}
                </td>
                <td className="border-b border-border px-4 text-center">
                  <ProductStatusBadge status={product.status} />
                </td>
                <td className="whitespace-nowrap border-b border-border px-4 text-right text-muted-foreground">
                  {product.defaultPrice ?? "-"}
                </td>
                <td className="border-b border-border px-4 text-muted-foreground">
                  {product.supplier ?? "-"}
                </td>
                <td className="border-b border-border px-4 text-right">
                  <ProductActions
                    categories={categories}
                    onFeedback={setFeedback}
                    product={product}
                    suppliers={suppliers}
                    units={units}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
