import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export const metadata: Metadata = { title: "Credit Notes" };

const statusBadge: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-600",
};

export default async function CreditNotesPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const result = await new CreditNoteService().list(context.organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Credit Notes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Credit notes issued against invoices.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Credit Note #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issued</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No credit notes yet.
                  </td>
                </tr>
              ) : (
                result.data.map((cn) => (
                  <tr key={cn.id} className="border-b transition hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/credit-notes/${cn.id}`} className="text-primary hover:underline">
                        {cn.creditNoteNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${cn.invoice.id}`} className="text-primary hover:underline">
                        {cn.invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{cn.customer.name}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(cn.totalAmount).toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[cn.status] ?? ""}`}>
                        {cn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cn.issuedAt ? new Date(cn.issuedAt).toLocaleDateString() : new Date(cn.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
