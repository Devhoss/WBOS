import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { WarehouseService } from "@/domains/warehouses/services/warehouse-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { WarehouseForm } from "./warehouse-form";
import { WarehouseTable } from "./warehouse-table";

export const metadata: Metadata = { title: "Warehouses" };

export default async function WarehousesPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [active, all] = await Promise.all([
    new WarehouseService().listActive(context),
    new WarehouseService().listAll(context),
  ]);

  const archived = all.filter((w) => w.archivedAt);

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

        <WarehouseTable
          warehouses={active.map((w) => ({
            id: w.id, name: w.name, code: w.code, address: w.address ?? "",
            isDefault: w.isDefault, archived: false,
          }))}
          archived={archived.map((w) => ({
            id: w.id, name: w.name, code: w.code, address: w.address ?? "",
            isDefault: w.isDefault, archived: true,
          }))}
        />
      </div>
    </AppShell>
  );
}
