import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CustomerService } from "@/domains/customers/services/customer-service";
import { CustomerBalanceService } from "@/domains/sales/services/customer-balance-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { CustomerForm } from "./customer-form";
import { CustomerTable } from "./customer-table";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [active, all] = await Promise.all([
    new CustomerService().listActive(context),
    new CustomerService().listAll(context),
  ]);

  const archived = all.filter((c) => c.archivedAt);
  const balanceService = new CustomerBalanceService();

  const allCustomers = [...active, ...archived];
  const balancePromises = allCustomers.map((c) =>
    balanceService.getBalanceSummary(context.organizationId, c.id).then((b) => ({ customerId: c.id, ...b })),
  );
  const balances = await Promise.all(balancePromises);
  const balanceMap = new Map(balances.map((b) => [b.customerId, b]));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Customers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Maintain customer records used by invoices, payments, balances, and statements.
          </p>
        </div>

        <CustomerForm />

        <CustomerTable
          customers={active.map((c) => ({
            id: c.id, name: c.name, code: c.code ?? "", contactName: c.contactName ?? "",
            email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "",
            paymentTerms: c.paymentTerms ?? "", creditLimit: c.creditLimit?.toString() ?? "",
            notes: c.notes ?? "", archived: false,
            outstanding: balanceMap.get(c.id)?.outstanding ?? 0,
          }))}
          archived={archived.map((c) => ({
            id: c.id, name: c.name, code: c.code ?? "", contactName: c.contactName ?? "",
            email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "",
            paymentTerms: c.paymentTerms ?? "", creditLimit: c.creditLimit?.toString() ?? "",
            notes: c.notes ?? "", archived: true,
            outstanding: balanceMap.get(c.id)?.outstanding ?? 0,
          }))}
        />
      </div>
    </AppShell>
  );
}
