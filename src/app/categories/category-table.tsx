"use client";

import { Package } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionMenu } from "@/components/action-menu";
import { activateCategory } from "@/domains/categories/actions/activate-category";
import { archiveCategory } from "@/domains/categories/actions/archive-category";
import { deleteCategory } from "@/domains/categories/actions/delete-category";

import { CategoryForm, type CategoryFormValue } from "./category-form";

type CategoryRow = {
  id: string; name: string; code: string; description: string;
  parentId: string; parentName: string | null; archived: boolean;
};

function toFormValue(c: CategoryRow): CategoryFormValue {
  return { id: c.id, name: c.name, code: c.code, description: c.description, parentId: c.parentId };
}

export function CategoryTable({ categories, archived, allCategories }: {
  categories: CategoryRow[]; archived: CategoryRow[]; allCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingCategory = [...categories, ...archived].find((c) => c.id === editingId) ?? null;

  async function runAction(action: () => Promise<{ ok: boolean; message?: string }>, msg: string) {
    setFeedback("");
    const result = await action();
    setFeedback(result.ok ? msg : result.message ?? "Unable to update category.");
    if (result.ok) router.refresh();
  }

  if (categories.length === 0 && archived.length === 0) {
    return (
      <section className="rounded-lg border px-6 py-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Package className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No categories yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create your first category to organize products.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border">
      {feedback ? <div className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">{feedback}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-11 px-4 text-left">Name</th><th className="h-11 px-4 text-left">Code</th>
              <th className="h-11 px-4 text-left">Parent</th><th className="h-11 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50">
                <td className="px-4 font-medium">{c.name}</td>
                <td className="px-4 text-muted-foreground">{c.code || "-"}</td>
                <td className="px-4 text-muted-foreground">{c.parentName ?? "-"}</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(c.id) },
                    { label: "Archive", onClick: () => void runAction(() => archiveCategory({ id: c.id }), "Category archived.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${c.name}? This cannot be undone if the category has no related records.`)) void runAction(() => deleteCategory({ id: c.id }), "Category deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
            {archived.length > 0 ? (
              <tr className="border-b bg-muted/30">
                <td className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground" colSpan={4}>Archived ({archived.length})</td>
              </tr>
            ) : null}
            {archived.map((c) => (
              <tr key={c.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50 text-muted-foreground">
                <td className="px-4 font-medium">{c.name}</td>
                <td className="px-4">{c.code || "-"}</td>
                <td className="px-4">{c.parentName ?? "-"}</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(c.id) },
                    { label: "Activate", onClick: () => void runAction(() => activateCategory({ id: c.id }), "Category activated.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${c.name}? This cannot be undone if the category has no related records.`)) void runAction(() => deleteCategory({ id: c.id }), "Category deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingCategory ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Edit Category</h2>
              <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" type="button" onClick={() => setEditingId(null)}>Close</button>
            </div>
            <div className="p-5">
              <CategoryForm category={toFormValue(editingCategory)} categories={allCategories} onSuccess={() => setEditingId(null)} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
