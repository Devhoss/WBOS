import { AppShell } from "@/components/app-shell";
import { CustomerService } from "@/domains/customers/services/customer-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { CustomerForm } from "./customer-form";

export default async function CustomersPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const customers = await new CustomerService().listActive(context);

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

        <section className="rounded-lg border">
          <div className="grid grid-cols-[1fr_120px_180px_140px] border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
            <span>Name</span>
            <span>Code</span>
            <span>Contact</span>
            <span>Credit Limit</span>
          </div>
          {customers.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No customers have been created yet.</p>
          ) : (
            customers.map((customer) => (
              <div key={customer.id} className="grid grid-cols-[1fr_120px_180px_140px] border-b px-4 py-3 text-sm last:border-b-0">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  {customer.email ? <p className="text-xs text-muted-foreground">{customer.email}</p> : null}
                </div>
                <span className="text-muted-foreground">{customer.code ?? "-"}</span>
                <span className="text-muted-foreground">{customer.contactName ?? customer.phone ?? "-"}</span>
                <span className="text-muted-foreground">
                  {customer.creditLimit === null ? "-" : `${customer.creditLimit.toString()} KWD`}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
