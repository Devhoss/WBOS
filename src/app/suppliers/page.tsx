import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SupplierService } from "@/domains/suppliers/services/supplier-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { SupplierForm } from "./supplier-form";
import { SupplierTable } from "./supplier-table";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [active, all] = await Promise.all([
    new SupplierService().listActive(context),
    new SupplierService().listAll(context),
  ]);

  const archived = all.filter((s) => s.archivedAt);

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

        <SupplierTable
          suppliers={active.map((s) => ({
            id: s.id, name: s.name, code: s.code ?? "", email: s.email ?? "",
            contactName: s.contactName ?? "", phone: s.phone ?? "",
            paymentTerms: s.paymentTerms ?? "", leadTimeDays: s.leadTimeDays,
            address: s.address ?? "", notes: s.notes ?? "", archived: false,
          }))}
          archived={archived.map((s) => ({
            id: s.id, name: s.name, code: s.code ?? "", email: s.email ?? "",
            contactName: s.contactName ?? "", phone: s.phone ?? "",
            paymentTerms: s.paymentTerms ?? "", leadTimeDays: s.leadTimeDays,
            address: s.address ?? "", notes: s.notes ?? "", archived: true,
          }))}
        />
      </div>
    </AppShell>
  );
}
