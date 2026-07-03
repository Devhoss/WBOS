import { AppShell } from "@/components/app-shell";
import { UnitOfMeasureService } from "@/domains/units/services/unit-of-measure-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { UnitOfMeasureForm } from "./unit-of-measure-form";

export default async function UnitsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const units = await new UnitOfMeasureService().listActive(context);

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

        <section className="rounded-lg border">
          <div className="grid grid-cols-[1fr_120px_180px_120px] border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
            <span>Name</span>
            <span>Code</span>
            <span>Conversion</span>
            <span>Status</span>
          </div>
          {units.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No units of measure have been created yet.</p>
          ) : (
            units.map((unit) => (
              <div key={unit.id} className="grid grid-cols-[1fr_120px_180px_120px] border-b px-4 py-3 text-sm last:border-b-0">
                <div>
                  <p className="font-medium">{unit.name}</p>
                  {unit.description ? <p className="text-xs text-muted-foreground">{unit.description}</p> : null}
                </div>
                <span className="text-muted-foreground">{unit.code}</span>
                <span className="text-muted-foreground">{unit.conversionToBase.toString()}</span>
                <span className="text-muted-foreground">{unit.isBaseUnit ? "Base" : "Active"}</span>
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
