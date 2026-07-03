"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { createCategory } from "@/domains/categories/actions/create-category";

type CategoryOption = {
  id: string;
  name: string;
};

export function CategoryForm({ categories }: { categories: CategoryOption[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      const result = await createCategory({
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").toUpperCase(),
        description: String(formData.get("description") ?? ""),
        parentId: String(formData.get("parentId") ?? ""),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to create category.");
        return;
      }

      setMessage("Category created.");
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">Create Category</h2>
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
          <span className="font-medium">Parent category</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="parentId">
            <option value="">None</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Description</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" name="description" />
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
