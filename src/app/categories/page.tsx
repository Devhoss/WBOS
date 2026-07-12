import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CategoryService } from "@/domains/categories/services/category-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { CategoryForm } from "./category-form";
import { CategoryTable } from "./category-table";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [active, all] = await Promise.all([
    new CategoryService().listActive(context),
    new CategoryService().listAll(context),
  ]);

  const archived = all.filter((c) => c.archivedAt);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Categories</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Group products for search, filtering, reporting, and future hierarchy.
          </p>
        </div>

        <CategoryForm categories={all.map((c) => ({ id: c.id, name: c.name }))} />

        <CategoryTable
          categories={active.map((c) => ({
            id: c.id, name: c.name, code: c.code ?? "", description: c.description ?? "",
            parentId: c.parentId ?? "", parentName: c.parent?.name ?? null, archived: false,
          }))}
          archived={archived.map((c) => ({
            id: c.id, name: c.name, code: c.code ?? "", description: c.description ?? "",
            parentId: c.parentId ?? "", parentName: c.parent?.name ?? null, archived: true,
          }))}
          allCategories={all.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </AppShell>
  );
}
