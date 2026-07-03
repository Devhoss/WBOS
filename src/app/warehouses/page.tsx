import { AppShell } from "@/components/app-shell";
import { WarehouseService } from "@/domains/warehouses/services/warehouse-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { WarehouseForm } from "./warehouse-form";

export default async function WarehousesPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const warehouses = await new WarehouseService().listActive(context);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Warehouses</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Configure physical storage locations before inventory workflows begin.
          </p>
        </div>

        <WarehouseForm />

        <section className="rounded-lg border">
          <div className="grid grid-cols-[1fr_120px_120px] border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
            <span>Name</span>
            <span>Code</span>
            <span>Status</span>
          </div>
          {warehouses.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No warehouses have been created yet.</p>
          ) : (
            warehouses.map((warehouse) => (
              <div key={warehouse.id} className="grid grid-cols-[1fr_120px_120px] border-b px-4 py-3 text-sm last:border-b-0">
                <div>
                  <p className="font-medium">{warehouse.name}</p>
                  {warehouse.address ? <p className="text-xs text-muted-foreground">{warehouse.address}</p> : null}
                </div>
                <span className="text-muted-foreground">{warehouse.code}</span>
                <span className="text-muted-foreground">{warehouse.isDefault ? "Default" : "Active"}</span>
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
