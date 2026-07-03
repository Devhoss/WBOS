import { AppShell } from "@/components/app-shell";
import { SupplierService } from "@/domains/suppliers/services/supplier-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SupplierForm } from "./supplier-form";

export default async function SuppliersPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const suppliers = await new SupplierService().listActive(context);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Suppliers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Maintain supplier relationships used by purchasing, shipments, and inventory lots.
          </p>
        </div>

        <SupplierForm />

        <section className="rounded-lg border">
          <div className="grid grid-cols-[1fr_120px_180px_120px] border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
            <span>Name</span>
            <span>Code</span>
            <span>Contact</span>
            <span>Lead Time</span>
          </div>
          {suppliers.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No suppliers have been created yet.</p>
          ) : (
            suppliers.map((supplier) => (
              <div key={supplier.id} className="grid grid-cols-[1fr_120px_180px_120px] border-b px-4 py-3 text-sm last:border-b-0">
                <div>
                  <p className="font-medium">{supplier.name}</p>
                  {supplier.email ? <p className="text-xs text-muted-foreground">{supplier.email}</p> : null}
                </div>
                <span className="text-muted-foreground">{supplier.code ?? "-"}</span>
                <span className="text-muted-foreground">{supplier.contactName ?? supplier.phone ?? "-"}</span>
                <span className="text-muted-foreground">
                  {supplier.leadTimeDays === null ? "-" : `${supplier.leadTimeDays} days`}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
