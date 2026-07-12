"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createCategory } from "@/domains/categories/actions/create-category";
import { updateCategory } from "@/domains/categories/actions/update-category";

export type CategoryFormValue = {
  id: string;
  name: string;
  code: string;
  description: string;
  parentId: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

export function CategoryForm({ categories, onSuccess, category }: {
  categories: CategoryOption[];
  onSuccess?: () => void;
  category?: CategoryFormValue;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(category);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const payload = {
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").toUpperCase(),
        description: String(formData.get("description") ?? ""),
        parentId: String(formData.get("parentId") ?? ""),
      };

      const result = category
        ? await updateCategory({ id: category.id, ...payload })
        : await createCategory(payload);

      if (!result.ok) {
        setMessage(result.message ?? `Unable to ${isEditing ? "update" : "create"} category.`);
        return;
      }

      setMessage(isEditing ? "Category updated." : "Category created.");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{isEditing ? "Edit Category" : "Create Category"}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={category?.name} name="name" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Code</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus:border-primary" defaultValue={category?.code} name="code" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Parent category</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={category?.parentId ?? ""} name="parentId">
            <option value="">None</option>
            {categories.filter((c) => c.id !== category?.id).map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Description</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" defaultValue={category?.description} name="description" />
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
