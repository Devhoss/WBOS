import { AppShell } from "@/components/app-shell";
import { CategoryService } from "@/domains/categories/services/category-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { CategoryForm } from "./category-form";

export default async function CategoriesPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const categories = await new CategoryService().listActive(context);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Categories</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Group products for search, filtering, reporting, and future hierarchy.
          </p>
        </div>

        <CategoryForm categories={categories.map((category) => ({ id: category.id, name: category.name }))} />

        <section className="rounded-lg border">
          <div className="grid grid-cols-[1fr_120px_180px_100px] border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
            <span>Name</span>
            <span>Code</span>
            <span>Parent</span>
            <span>Children</span>
          </div>
          {categories.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No categories have been created yet.</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="grid grid-cols-[1fr_120px_180px_100px] border-b px-4 py-3 text-sm last:border-b-0">
                <div>
                  <p className="font-medium">{category.name}</p>
                  {category.description ? <p className="text-xs text-muted-foreground">{category.description}</p> : null}
                </div>
                <span className="text-muted-foreground">{category.code ?? "-"}</span>
                <span className="text-muted-foreground">{category.parent?.name ?? "-"}</span>
                <span className="text-muted-foreground">{category._count.children}</span>
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
