import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { UnitOfMeasureService } from "@/domains/units/services/unit-of-measure-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { UnitOfMeasureForm } from "./unit-of-measure-form";
import { UnitTable } from "./unit-table";

export const metadata: Metadata = { title: "Units of Measure" };

export default async function UnitsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [active, all] = await Promise.all([
    new UnitOfMeasureService().listActive(context),
    new UnitOfMeasureService().listAll(context),
  ]);

  const archived = all.filter((u) => u.archivedAt);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Units of Measure</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Define how products are counted, purchased, stored, and sold.
          </p>
        </div>

        <UnitOfMeasureForm />

        <UnitTable
          units={active.map((u) => ({
            id: u.id, name: u.name, code: u.code, description: u.description ?? "",
            isBaseUnit: u.isBaseUnit, conversionToBase: u.conversionToBase.toString(), archived: false,
          }))}
          archived={archived.map((u) => ({
            id: u.id, name: u.name, code: u.code, description: u.description ?? "",
            isBaseUnit: u.isBaseUnit, conversionToBase: u.conversionToBase.toString(), archived: true,
          }))}
        />
      </div>
    </AppShell>
  );
}
